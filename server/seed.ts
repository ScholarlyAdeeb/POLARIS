import type { Db } from './pg.ts';
import {
  HOTSPOT_DATA,
  STATIONS_DATA,
  EXPEDITION_MILESTONES,
  SCIENTIFIC_PAPERS,
  SIMULATION_MISSIONS,
  VALUE_GRAPH_STEPS,
} from '../src/data/polarisData.ts';
import { insertItems, type ArchiveInput } from './db.ts';

// Every record added here (beyond what the frontend already shipped) is demo
// content and carries meta.sample = true so it is never mistaken for real
// NCPOR holdings. Replace through the admin API with real records.

const IMG = {
  southPole: STATIONS_DATA.find((s) => s.id === 'dakshin-gangotri')!.imageUrl,
  bharati: STATIONS_DATA.find((s) => s.id === 'bharati')!.imageUrl,
  maitri: STATIONS_DATA.find((s) => s.id === 'maitri')!.imageUrl,
  himadri: STATIONS_DATA.find((s) => s.id === 'himadri')!.imageUrl,
  himansh: STATIONS_DATA.find((s) => s.id === 'himansh')!.imageUrl,
  sagarKanya: STATIONS_DATA.find((s) => s.id === 'sagar-kanya')!.imageUrl,
};

function parseSize(size: string): { format: string; size: string } {
  const [format, value] = size.split('/').map((s) => s.trim());
  return value ? { format, size: value } : { format: 'NETCDF', size };
}

function expeditionId(year: number, title: string) {
  return `exp-${year}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24).replace(/-$/, '')}`;
}

/** Seeds an empty database. Runs inside the caller's transaction. */
export async function seedDatabase(db: Db): Promise<void> {
  {
    // --- Site structure -----------------------------------------------------
    for (const [i, s] of STATIONS_DATA.entries()) await db.run('INSERT INTO stations (id, domain, sort, data) VALUES (?, ?, ?, ?)', s.id, s.domain, i, JSON.stringify(s));
    for (const [k, h] of Object.entries(HOTSPOT_DATA)) await db.run('INSERT INTO hotspots (id, station_id, data) VALUES (?, ?, ?)', Number(k), 'bharati', JSON.stringify(h));
    for (const [i, m] of SIMULATION_MISSIONS.entries()) await db.run('INSERT INTO simulations (id, sort, data) VALUES (?, ?, ?)', m.id, i, JSON.stringify(m));
    for (const s of VALUE_GRAPH_STEPS) await db.run('INSERT INTO value_graph_steps (step, data) VALUES (?, ?)', s.step, JSON.stringify(s));

    const items: ArchiveInput[] = [];
    const links: [string, string, string][] = [];

    // --- Expeditions (timeline milestones) ---------------------------------
    const stationByYear: Record<number, string> = {
      1983: 'dakshin-gangotri',
      1989: 'maitri',
      2008: 'himadri',
      2012: 'bharati',
      2016: 'himansh',
      2026: 'bharati',
    };
    for (const m of EXPEDITION_MILESTONES) {
      items.push({
        id: expeditionId(m.year, m.title),
        type: 'expedition',
        title: m.title,
        summary: m.description,
        body: m.highlights.join('. ') + '.',
        domain: m.latLng[0] > 60 ? 'ARCTIC' : m.latLng[0] > 0 ? 'HIMALAYAS / THIRD POLE' : 'ANTARCTICA',
        stationId: stationByYear[m.year] ?? null,
        year: m.year,
        tags: [m.badge, 'expedition', 'timeline'],
        meta: { badge: m.badge, leader: m.leader ?? null, highlights: m.highlights, latLng: m.latLng, milestone: true },
      });
    }
    const exp2010 = expeditionId(2010, EXPEDITION_MILESTONES.find((m) => m.year === 2010)!.title);
    const exp2026 = expeditionId(2026, EXPEDITION_MILESTONES.find((m) => m.year === 2026)!.title);

    // --- Datasets ------------------------------------------------------------
    // 1) One per Bharati hotspot payload
    for (const h of Object.values(HOTSPOT_DATA)) {
      const { format, size } = parseSize(h.datasetSize);
      const id = h.datasetTitle.split(':')[0].trim();
      items.push({
        id,
        type: 'dataset',
        title: h.datasetTitle,
        summary: h.what,
        body: h.why,
        domain: 'ANTARCTICA',
        stationId: 'bharati',
        year: 2024,
        tags: [h.title, h.expeditionTeam, format.toLowerCase()],
        doi: h.datasetDoi || null,
        meta: { format, size, fileName: `${id}.${format === 'CSV' ? 'csv' : 'nc'}`, license: 'CC-BY 4.0', payload: h.id, expedition: h.expeditionTitle, sample: true },
      });
      links.push([id, exp2026, 'collected_during']);
    }

    // 2) Supplementary files referenced by publications
    const paperDatasetIds: Record<string, string> = {};
    for (const p of SCIENTIFIC_PAPERS) {
      const id = `DS-${p.id.toUpperCase()}`;
      const ext = p.dataFile.split('.').slice(1).join('.');
      paperDatasetIds[p.id] = id;
      items.push({
        id,
        type: 'dataset',
        title: p.dataFile,
        summary: `Supplementary data for “${p.title}”.`,
        domain: p.domain,
        year: 2024,
        stationId:
          p.id === 'paper-1' ? 'himansh' : p.id === 'paper-2' ? 'maitri' : p.id === 'paper-3' ? 'sagar-kanya' : 'bharati',
        tags: [p.domain, ext],
        meta: { format: ext.toUpperCase(), size: p.fileSize, fileName: p.dataFile, license: 'CC-BY 4.0', sample: true },
      });
    }

    // 3) Dataset referenced from the Explore “linked records” strip
    items.push({
      id: 'NCPOR-MET-2023-042',
      type: 'dataset',
      title: 'Maitri AOD Radiometry 2023',
      summary: 'Hourly aerosol optical depth from a sun-photometer at Maitri station during the 42nd ISEA season.',
      domain: 'ATMOSPHERIC PHYSICS',
      stationId: 'maitri',
      year: 2023,
      tags: ['aerosol', 'radiometry', 'AOD', 'Maitri', 'atmospheric'],
      meta: { format: 'NETCDF', size: '96 MB', fileName: 'NCPOR-MET-2023-042.nc', license: 'CC-BY 4.0', sample: true },
    });

    // --- Publications ------------------------------------------------------
    for (const p of SCIENTIFIC_PAPERS) {
      items.push({
        id: p.id,
        type: 'publication',
        title: p.title,
        summary: p.abstract,
        domain: p.domain,
        stationId: paperDatasetIds[p.id] ? items.find((i) => i.id === paperDatasetIds[p.id])!.stationId : null,
        year: 2024,
        tags: [p.domain, 'publication'],
        doi: p.doi || null,
        meta: {
          journal: p.journal,
          acceptedDate: p.acceptedDate,
          authors: p.authors,
          dataFile: p.dataFile,
          fileSize: p.fileSize,
          sample: true,
        },
      });
      links.push([p.id, paperDatasetIds[p.id], 'uses_data']);
    }

    // --- Expedition reports & logbooks --------------------------------------
    items.push(
      {
        id: 'RPT-ISEA42-ATMOS',
        type: 'report',
        title: 'ISEA-42 Atmospheric Bulletin',
        summary: 'Season summary of aerosol, ozone and boundary-layer observations made at Maitri during the 42nd ISEA.',
        body: 'Covers sun-photometer AOD, Brewer ozone column, radiosonde launches and instrument downtime for the 2022–23 summer season.',
        domain: 'ATMOSPHERIC PHYSICS',
        stationId: 'maitri',
        year: 2023,
        tags: ['ISEA-42', 'bulletin', 'Maitri', 'atmospheric', 'ozone', 'aerosol'],
        meta: { pages: 36, format: 'PDF', sample: true },
      },
      {
        id: 'LOG-ISEA42-VOYAGE',
        type: 'report',
        title: '42nd ISEA Voyage Logbook',
        summary: 'Voyage manifests, ship track and cargo operations for the 42nd Indian Scientific Expedition to Antarctica.',
        domain: 'ANTARCTICA',
        year: 2023,
        tags: ['ISEA-42', 'logbook', 'voyage'],
        meta: { vault: 'MoES Expedition Vault', sample: true },
      },
      {
        id: 'LOG-EXP-45',
        type: 'report',
        title: '45th ISEA Field Logbook (EXP-45)',
        summary: 'Winter crew roster and daily science manifest for the 45th ISEA at Bharati.',
        domain: 'ANTARCTICA',
        stationId: 'bharati',
        year: 2026,
        tags: ['ISEA-45', 'logbook', 'Bharati', 'winter'],
        meta: { sample: true },
      }
    );
    links.push(['RPT-ISEA42-ATMOS', 'NCPOR-MET-2023-042', 'describes']);
    links.push(['LOG-EXP-45', exp2026, 'part_of']);

    // --- Photos & videos ----------------------------------------------------
    items.push(
      {
        id: 'PHOTO-SOUTH-POLE-2010',
        type: 'photo',
        title: 'South Pole Scientific Traverse 2010',
        summary: 'NCPOR 8-member convoy reaching the 90°S geographic pole.',
        domain: 'ANTARCTICA',
        year: 2010,
        tags: ['South Pole', 'traverse', 'historical', 'photo vault'],
        url: IMG.southPole,
        thumbnailUrl: IMG.southPole,
        meta: { collection: 'Historical Photo Vault', sample: true },
      },
      {
        id: 'PHOTO-BHARATI-EXTERIOR',
        type: 'photo',
        title: 'Bharati Station on the Grovnes Peninsula',
        summary: 'The modular station built from ISO containers above Prydz Bay.',
        domain: 'ANTARCTICA',
        stationId: 'bharati',
        year: 2024,
        tags: ['Bharati', 'station', 'architecture'],
        url: IMG.bharati,
        thumbnailUrl: IMG.bharati,
        meta: { collection: 'Station Portraits', sample: true },
      },
      {
        id: 'PHOTO-MAITRI-OASIS',
        type: 'photo',
        title: 'Maitri and the Schirmacher Oasis',
        summary: 'Maitri station in the ice-free Schirmacher Oasis near Lake Priyadarshini.',
        domain: 'ANTARCTICA',
        stationId: 'maitri',
        year: 2023,
        tags: ['Maitri', 'Schirmacher Oasis', 'Lake Priyadarshini'],
        url: IMG.maitri,
        thumbnailUrl: IMG.maitri,
        meta: { collection: 'Station Portraits', sample: true },
      },
      {
        id: 'PHOTO-HIMADRI-KONGSFJORDEN',
        type: 'photo',
        title: 'Himadri, Ny-Ålesund',
        summary: 'India’s Arctic station in the Ny-Ålesund research settlement, Svalbard.',
        domain: 'ARCTIC',
        stationId: 'himadri',
        year: 2024,
        tags: ['Himadri', 'Arctic', 'Svalbard', 'Kongsfjorden'],
        url: IMG.himadri,
        thumbnailUrl: IMG.himadri,
        meta: { collection: 'Station Portraits', sample: true },
      },
      {
        id: 'PHOTO-HIMANSH-SPITI',
        type: 'photo',
        title: 'Himansh Observatory, Spiti',
        summary: 'High-altitude cryosphere observatory in the Chandra basin at 4,080 m.',
        domain: 'HIMALAYAS / THIRD POLE',
        stationId: 'himansh',
        year: 2024,
        tags: ['Himansh', 'Himalaya', 'glacier', 'Spiti'],
        url: IMG.himansh,
        thumbnailUrl: IMG.himansh,
        meta: { collection: 'Station Portraits', sample: true },
      },
      {
        id: 'PHOTO-SAGAR-KANYA',
        type: 'photo',
        title: 'ORV Sagar Kanya in the Southern Ocean',
        summary: 'Research vessel on the Subtropical Front transect.',
        domain: 'SOUTHERN OCEAN',
        stationId: 'sagar-kanya',
        year: 2024,
        tags: ['Sagar Kanya', 'ship', 'Southern Ocean', 'cruise'],
        url: IMG.sagarKanya,
        thumbnailUrl: IMG.sagarKanya,
        meta: { collection: 'Cruise Photography', sample: true },
      },
      {
        id: 'VIDEO-WINTERING-ALONE-04',
        type: 'video',
        title: 'Wintering Alone: 280 Days in the Polar Darkness',
        summary: 'Docu-series episode 04 following a winter-over team through the Antarctic polar night.',
        domain: 'ANTARCTICA',
        stationId: 'bharati',
        year: 2025,
        tags: ['docu-series', 'winter', 'polar night', 'crew'],
        thumbnailUrl: IMG.bharati,
        meta: { duration: '08:42', episode: 4, transcripts: ['EN', 'HI'], sample: true },
      }
    );
    links.push(['PHOTO-SOUTH-POLE-2010', exp2010, 'documents']);

    // --- Institutional activities ------------------------------------------
    items.push(
      {
        id: 'ACT-CFP-ISEA46',
        type: 'activity',
        title: 'Call for Research Proposals: 46th ISEA & upcoming Arctic season',
        summary: 'NCPOR invites field research proposals for Bharati, Maitri, Himadri and Southern Ocean cruises. Dates to be announced.',
        domain: 'ANTARCTICA',
        year: 2026,
        tags: ['call for proposals', 'ISEA-46', 'Arctic'],
        meta: { kind: 'announcement', sample: true },
      },
      {
        id: 'ACT-POLAR-ACADEMY-PILOT',
        type: 'activity',
        title: 'Polar Academy classroom pilot',
        summary: 'Interactive simulations (Maitri survival, ice-core lab, IndARC) trialled with school classrooms.',
        domain: 'ANTARCTICA',
        year: 2026,
        tags: ['outreach', 'education', 'Polar Academy'],
        meta: { kind: 'outreach', sample: true },
      }
    );

    await insertItems(db, items);
    await db.run(
      `INSERT INTO item_links (from_id, to_id, relation) VALUES ${links.map(() => '(?, ?, ?)').join(', ')} ON CONFLICT DO NOTHING`,
      ...links.flat()
    );
  }
}
