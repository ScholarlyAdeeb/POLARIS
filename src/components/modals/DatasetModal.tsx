import React from 'react';

interface DatasetModalProps {
  datasetName: string | null;
  onClose: () => void;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({ datasetName, onClose }) => {
  if (!datasetName) return null;

  const sampleNetcdfHeader = `netcdf ${datasetName} {
dimensions:
	time = UNLIMITED ; // (8760 currently)
	altitude = 120 ;
	lat = 1 ;
	lon = 1 ;
variables:
	double time(time) ;
		time:units = "seconds since 2024-01-01 00:00:00 UTC" ;
		time:calendar = "standard" ;
	float altitude(altitude) ;
		altitude:units = "meters above ground level" ;
	float aerosol_backscatter(time, altitude) ;
		aerosol_backscatter:units = "m-1 sr-1" ;
		aerosol_backscatter:long_name = "532nm Total Attenuated Backscatter Coefficient" ;
	float optical_depth(time) ;
		optical_depth:units = "dimensionless" ;
		optical_depth:long_name = "Aerosol Optical Depth (AOD)" ;

// global attributes:
		:institution = "National Centre for Polar and Oceanic Research (NCPOR), MoES, India" ;
		:station = "Bharati Antarctic Research Base (69.408°S, 76.187°E)" ;
		:instrument = "Raman-Mie Micro-Pulse Lidar Array" ;
		:convention = "CF-1.8, ISO 19115" ;
		:license = "CC-BY 4.0 International" ;
}`;

  const triggerDownload = () => {
    const blob = new Blob([sampleNetcdfHeader], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = datasetName.endsWith('.nc') ? datasetName : `${datasetName}.nc`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#0b132b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff] dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#00b4d8] text-white">
              <span className="material-symbols-outlined text-[20px]">dataset</span>
            </span>
            <div>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                NCPOR OPEN DATA VAULT
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] dark:text-white mt-0.5">
                {datasetName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter']">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-['JetBrains_Mono'] text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">FORMAT</span>
              <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">NetCDF-4 / HDF5</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">COMPRESSION</span>
              <span className="font-bold text-slate-800 dark:text-white">Deflate Level 4</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">RECORDS</span>
              <span className="font-bold text-slate-800 dark:text-white">8,760 Hours (1 Yr)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">LICENSE</span>
              <span className="font-bold text-emerald-600">CC-BY 4.0</span>
            </div>
          </div>

          <div>
            <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              CF-1.8 NetCDF Metadata Header Structure
            </h4>
            <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-['JetBrains_Mono'] text-xs leading-relaxed overflow-x-auto border border-slate-800">
              {sampleNetcdfHeader}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            Validated by NCPOR Polar Data Centre • Vasco-da-Gama, Goa
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerDownload}
              className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download Dataset</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-['JetBrains_Mono'] text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
