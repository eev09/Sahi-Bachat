import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Clock, FileText, ExternalLink, AlertCircle, ClipboardList, ChevronDown } from 'lucide-react';
import { TrackedScheme } from '../types/schemes';
import { cn } from '../lib/utils';

interface ApplicationTrackerProps {
  trackedSchemes: TrackedScheme[];
  onUpdateStatus: (id: string, status: TrackedScheme['status']) => void;
  onUpdateDocStatus: (id: string, docIndex: number, status: 'done' | 'pending') => void;
}

export function ApplicationTracker({ trackedSchemes, onUpdateStatus, onUpdateDocStatus }: ApplicationTrackerProps) {
  const { t } = useTranslation();

  const [localDummySchemes, setLocalDummySchemes] = useState<TrackedScheme[]>([
    {
      id: 'dummy_app_1',
      schemeName: t('dummy_app_1_name'),
      description: t('dummy_app_1_desc'),
      reason: t('dummy_app_1_reason'),
      status: 'approved',
      lastUpdated: '2023-10-20',
      documents: [
        { name: t('dummy_doc_1'), status: 'done' },
        { name: t('dummy_doc_2'), status: 'done' },
        { name: t('dummy_doc_3'), status: 'done' }
      ],
      officialLink: 'https://www.myscheme.gov.in/'
    },
    {
      id: 'dummy_app_2',
      schemeName: t('dummy_app_2_name'),
      description: t('dummy_app_2_desc'),
      reason: t('dummy_app_2_reason'),
      status: 'submitted',
      lastUpdated: '2023-10-22',
      documents: [
        { name: t('dummy_doc_1'), status: 'done' },
        { name: t('dummy_doc_4'), status: 'done' }
      ],
      officialLink: 'https://www.myscheme.gov.in/'
    },
    {
      id: 'dummy_app_3',
      schemeName: t('dummy_app_3_name'),
      description: t('dummy_app_3_desc'),
      reason: t('dummy_app_3_reason'),
      status: 'not_started',
      lastUpdated: '2023-10-25',
      documents: [
        { name: t('dummy_doc_1'), status: 'pending' },
        { name: t('dummy_doc_2'), status: 'pending' }
      ],
      officialLink: 'https://www.npscra.nsdl.co.in/scheme-details.php'
    }
  ]);

  // Update dummy schemes when language changes
  useEffect(() => {
    setLocalDummySchemes(prev => prev.map(app => {
      if (app.id === 'dummy_app_1') return { ...app, schemeName: t('dummy_app_1_name'), description: t('dummy_app_1_desc'), reason: t('dummy_app_1_reason'), documents: app.documents.map((d, i) => ({ ...d, name: t(`dummy_doc_${i+1}`) })) };
      if (app.id === 'dummy_app_2') return { ...app, schemeName: t('dummy_app_2_name'), description: t('dummy_app_2_desc'), reason: t('dummy_app_2_reason'), documents: app.documents.map((d, i) => ({ ...d, name: i === 0 ? t('dummy_doc_1') : t('dummy_doc_4') })) };
      if (app.id === 'dummy_app_3') return { ...app, schemeName: t('dummy_app_3_name'), description: t('dummy_app_3_desc'), reason: t('dummy_app_3_reason'), documents: app.documents.map((d, i) => ({ ...d, name: t(`dummy_doc_${i+1}`) })) };
      return app;
    }));
  }, [t]);

  const handleUpdateStatus = (id: string, status: TrackedScheme['status']) => {
    if (id.startsWith('dummy_')) {
      setLocalDummySchemes(prev => prev.map(app => 
        app.id === id ? { ...app, status, lastUpdated: new Date().toLocaleDateString() } : app
      ));
    } else {
      onUpdateStatus(id, status);
    }
  };

  const handleUpdateDocStatus = (id: string, docIndex: number, status: 'done' | 'pending') => {
    if (id.startsWith('dummy_')) {
      setLocalDummySchemes(prev => prev.map(app => {
        if (app.id === id) {
          const newDocs = [...app.documents];
          newDocs[docIndex] = { ...newDocs[docIndex], status };
          return { ...app, documents: newDocs, lastUpdated: new Date().toLocaleDateString() };
        }
        return app;
      }));
    } else {
      onUpdateDocStatus(id, docIndex, status);
    }
  };

  const allSchemes = [...localDummySchemes, ...trackedSchemes];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-100';
      case 'submitted': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'in_progress': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'not_started': return 'text-gray-600 bg-gray-50 border-gray-100';
      default: return 'text-orange-600 bg-orange-50 border-orange-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-5 h-5" />;
      case 'submitted': return <Clock className="w-5 h-5" />;
      case 'in_progress': return <Clock className="w-5 h-5" />;
      case 'not_started': return <Circle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">{t('application_tracker')}</h2>
        <p className="text-gray-500">{t('tracker_desc')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {allSchemes.length > 0 ? (
          allSchemes.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-gray-800">{app.schemeName}</h3>
                    {app.description && <p className="text-sm text-gray-600">{app.description}</p>}
                    {app.reason && (
                      <div className="mt-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100/50">
                        <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">{t('why_this_fits_you')}:</p>
                        <p className="text-sm text-orange-900 italic">"{app.reason}"</p>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">{t('last_updated')}: {app.lastUpdated}</p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="relative">
                      <select 
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.id, e.target.value as TrackedScheme['status'])}
                        className={cn(
                          "w-full appearance-none flex items-center gap-2 px-4 py-2 pr-10 rounded-full border text-sm font-bold cursor-pointer outline-none transition-all focus:ring-2 focus:ring-orange-500/20",
                          getStatusColor(app.status)
                        )}
                      >
                        <option value="not_started">{t('not_started')}</option>
                        <option value="in_progress">{t('in_progress')}</option>
                        <option value="submitted">{t('submitted')}</option>
                        <option value="approved">{t('approved')}</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
                        {getStatusIcon(app.status)}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('documents_required')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {app.documents.map((doc, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => handleUpdateDocStatus(app.id, idx, doc.status === 'done' ? 'pending' : 'done')}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all text-left",
                          doc.status === 'done' ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100 hover:border-orange-200"
                        )}
                      >
                        <span className={cn(
                          "text-sm font-medium",
                          doc.status === 'done' ? "text-green-700" : "text-gray-700"
                        )}>{doc.name}</span>
                        {doc.status === 'done' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t flex flex-col md:flex-row gap-4">
                  <a
                    href={app.officialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
                  >
                    {t('official_website')}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.myscheme.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-50 text-orange-700 rounded-2xl font-bold hover:bg-orange-100 transition-all"
                  >
                    {t('visit_myscheme')}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_apps_tracked')}</p>
            <p className="text-sm text-gray-400 mt-2">{t('talk_to_assistant_desc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
