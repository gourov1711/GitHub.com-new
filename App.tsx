
import React, { useState, useEffect, useMemo } from 'react';
import { Appliance, StateTariff, CalculationResult, HistoricalEntry, AppStep, Season, SolarConfig, Language, SubsidyConfig, CloudProfile, UserDailyUsage, SubsidyType } from './types.ts';
import { INDIAN_STATES } from './constants.ts';
import { getFullCalculation } from './utils/calculator.ts';
import Dashboard from './components/Dashboard.tsx';
import ApplianceForm from './components/ApplianceForm.tsx';
import HistoryView from './components/HistoryView.tsx';
import OptimizationCenter from './components/OptimizationCenter.tsx';
import CloudProfileView from './components/CloudProfileView.tsx';
import AuthView from './components/AuthView.tsx';
import DailyCalendar from './components/DailyCalendar.tsx';
import NotificationCenter from './components/NotificationCenter.tsx';
import { translations, LANG_LIST } from './translations.ts';
import { generateNotifications } from './utils/notificationGenerator.ts';
import { ElecaLogo } from './components/ElecaLogo.tsx';

const App: React.FC = () => {
  // --- ATOMIC STATE INITIALIZATION (Lazy Initializers) ---
  const [profile, setProfile] = useState<CloudProfile | null>(() => {
    const saved = localStorage.getItem('eleca_active_session');
    return saved ? JSON.parse(saved) : null;
  });

  const getPersistentData = () => {
    const saved = localStorage.getItem('eleca_app_data');
    return saved ? JSON.parse(saved) : {};
  };

  const initialData = getPersistentData();

  const [step, setStep] = useState<AppStep>(() => profile ? 'bill' : 'intro');
  const [lang, setLang] = useState<Language>(initialData.lang || 'en');
  const [selectedStateId, setSelectedStateId] = useState<string>(initialData.selectedStateId || INDIAN_STATES[0].id);
  const [appliances, setAppliances] = useState<Appliance[]>(initialData.appliances || []);
  const [dailyLogs, setDailyLogs] = useState<UserDailyUsage[]>(initialData.dailyLogs || []);
  const [history, setHistory] = useState<HistoricalEntry[]>(initialData.history || []);
  const [season, setSeason] = useState<Season>(initialData.season || 'summer');
  const [solarConfig, setSolarConfig] = useState<SolarConfig>(initialData.solarConfig || { isInstalled: false, ratingKw: 3 });
  const [subsidyConfig, setSubsidyConfig] = useState<SubsidyConfig>(initialData.subsidyConfig || { type: 'none', limitUnits: 0 });
  
  const [showAppForm, setShowAppForm] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState<Appliance | undefined>(undefined);

  // Persistence: Save state on every change
  useEffect(() => {
    if (profile) {
      const data = {
        appliances,
        selectedStateId,
        solarConfig,
        subsidyConfig,
        season,
        lang,
        history,
        dailyLogs
      };
      localStorage.setItem('eleca_app_data', JSON.stringify(data));
      localStorage.setItem('eleca_active_session', JSON.stringify(profile));
    }
  }, [profile, appliances, selectedStateId, solarConfig, subsidyConfig, season, lang, history, dailyLogs]);

  const stateTariff = useMemo(() => 
    INDIAN_STATES.find(s => s.id === selectedStateId) || INDIAN_STATES[0],
  [selectedStateId]);

  const t = useMemo(() => (key: string) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  }, [lang]);

  const calculationResult = useMemo(() => {
    // Crucial: Calculate based on current live state to ensure reactive updates
    return getFullCalculation(appliances, stateTariff, solarConfig, subsidyConfig, season);
  }, [appliances, stateTariff, solarConfig, subsidyConfig, season]);

  const notifications = useMemo(() => 
    generateNotifications(calculationResult, stateTariff, dailyLogs, lang),
  [calculationResult, stateTariff, dailyLogs, lang]);

  const handleAddAppliance = (app: Appliance) => {
    setAppliances(prev => {
      const exists = prev.find(a => a.id === app.id);
      if (exists) return prev.map(a => a.id === app.id ? app : a);
      return [...prev, app];
    });
    setShowAppForm(false);
    setEditingAppliance(undefined);
  };

  const handleEditAppliance = (app: Appliance) => {
    setEditingAppliance(app);
    setShowAppForm(true);
  };

  const handleDeleteAppliance = (id: string) => {
    setAppliances(prev => prev.filter(a => a.id !== id));
  };

  const handleSaveForecast = () => {
    const newEntry: HistoricalEntry = {
      id: `hist-${Date.now()}`,
      timestamp: Date.now(),
      totalUnits: calculationResult.totalUnits,
      totalCost: calculationResult.totalCost,
      stateName: stateTariff.name
    };
    setHistory(prev => [newEntry, ...prev]);
    setStep('history');
  };

  const handleSaveLog = (log: UserDailyUsage) => {
    setDailyLogs(prev => {
      const exists = prev.find(l => l.date === log.date);
      if (exists) return prev.map(l => l.date === log.date ? log : l);
      return [...prev, log];
    });
  };

  const handleUndoLast = () => {
    setDailyLogs(prev => prev.slice(0, -1));
  };

  const handleLogin = (p: CloudProfile) => {
    setProfile(p);
    setStep('language');
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('eleca_active_session');
    localStorage.removeItem('eleca_app_data');
    setStep('intro');
  };

  if (!profile && step !== 'intro') return <AuthView lang={lang} onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-eleca-indigo selection:bg-eleca-green selection:text-black overflow-x-hidden">
      {step !== 'intro' && (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 nav-blur h-24 px-8 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-50 flex items-center gap-6 sm:gap-10 animate-in slide-in-from-bottom-10 duration-1000">
          {[
            { id: 'bill', icon: '📊', label: t('nav_stats') },
            { id: 'history', icon: '📈', label: t('history') },
            { id: 'calendar', icon: '📅', label: t('nav_logs') },
            { id: 'optimization', icon: '⚡', label: t('nav_save') },
            { id: 'notifications', icon: '🔔', label: t('nav_inbox'), badge: notifications.length },
            { id: 'profile', icon: '👤', label: t('nav_me') }
          ].map(nav => (
            <button
              key={nav.id}
              onClick={() => setStep(nav.id as AppStep)}
              className={`relative flex flex-col items-center gap-2 spring-transition group ${step === nav.id ? 'scale-110' : 'opacity-30 hover:opacity-100'}`}
            >
              <span className={`text-2xl transition-transform group-hover:-translate-y-1 ${step === nav.id ? 'drop-shadow-[0_0_10px_#1ED760]' : ''}`}>{nav.icon}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${step === nav.id ? 'text-eleca-green' : 'text-white'}`}>
                {nav.label}
              </span>
              {nav.badge ? (
                <span className="absolute -top-1.5 -right-3 w-5 h-5 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-eleca-indigo shadow-lg">
                  {nav.badge}
                </span>
              ) : null}
              {step === nav.id && <div className="absolute -bottom-4 w-1.5 h-1.5 bg-eleca-green rounded-full shadow-[0_0_10px_#1ED760]" />}
            </button>
          ))}
        </nav>
      )}

      <main className="max-w-xl mx-auto px-6 pt-12 pb-40">
        {step === 'intro' && (
          <div className="min-h-[88vh] flex flex-col items-center justify-center text-center space-y-16 animate-in fade-in zoom-in duration-1000">
            <ElecaLogo size="lg" animate />
            <div className="space-y-6">
              <h1 className="text-8xl font-[900] tracking-tighter text-white uppercase italic leading-none drop-shadow-2xl">ELECA</h1>
              <p className="text-sm font-[900] text-eleca-green uppercase tracking-[0.6em] opacity-80 max-w-xs mx-auto italic leading-relaxed">
                India's Intelligent Energy Coach
              </p>
            </div>
            <button
              onClick={() => setStep('language')}
              className="group bg-white text-black px-14 py-7 rounded-full font-black text-sm uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all active:scale-95 flex items-center gap-4 italic hover:bg-eleca-green"
            >
              {t('start')}
              <span className="group-hover:translate-x-2 transition-transform">➔</span>
            </button>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] italic">V3.5 — Sovereign Protocol Active</p>
          </div>
        )}

        {step === 'language' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-700">
            <div className="text-center">
              <h2 className="text-4xl font-[900] text-white tracking-tighter uppercase italic">{t('lang_select')}</h2>
              <p className="text-[11px] font-[900] text-white/30 uppercase tracking-[0.5em] mt-3 italic">{t('lang_subtitle')}</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {LANG_LIST.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setLang(l.id as Language); setStep('state'); }}
                  className={`p-10 rounded-[3rem] glass-card border-2 transition-all flex flex-col items-center gap-3 group relative overflow-hidden ${lang === l.id ? 'border-eleca-green shadow-[0_0_30px_rgba(30,215,96,0.15)] bg-eleca-green/10' : 'border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-white transition-colors">{l.name}</span>
                  <span className={`text-3xl font-[900] italic ${lang === l.id ? 'text-eleca-green' : 'text-white'}`}>{l.native}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'state' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-700">
             <div className="text-center">
              <h2 className="text-4xl font-[900] text-white tracking-tighter uppercase italic">{t('region_title')}</h2>
              <p className="text-[11px] font-[900] text-white/30 uppercase tracking-[0.5em] mt-3 italic">{t('region_subtitle')}</p>
            </div>
            <div className="glass-card p-6 rounded-[4rem] shadow-2xl grid grid-cols-1 gap-3 max-h-[65vh] overflow-y-auto custom-scrollbar border border-white/10">
              {INDIAN_STATES.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStateId(s.id); setStep('setup'); }}
                  className={`p-7 rounded-[2rem] text-left font-black transition-all flex items-center justify-between group ${selectedStateId === s.id ? 'bg-eleca-green text-black italic' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
                >
                  <span className="tracking-tight uppercase text-sm">{s.name}</span>
                  <span className={`text-xl opacity-20 group-hover:opacity-100 transition-opacity`}>➔</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-700 pb-12">
            <div className="text-center">
              <h2 className="text-4xl font-[900] text-white tracking-tighter uppercase italic">{t('solar_setup')}</h2>
              <p className="text-[11px] font-[900] text-white/30 uppercase tracking-[0.5em] mt-3 italic">{t('infra_logic')}</p>
            </div>

            <div className="glass-card p-12 sm:p-14 rounded-[4.5rem] space-y-14 shadow-2xl border border-white/10">
              <div className="space-y-6">
                <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] ml-6 italic">{t('season_title')}</label>
                <div className="grid grid-cols-3 gap-3 bg-eleca-indigo p-2.5 rounded-[2.5rem] border border-white/10 shadow-inner">
                  {(['summer', 'winter', 'monsoon'] as Season[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setSeason(s)}
                      className={`py-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all spring-transition ${season === s ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.2)] scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                    >
                      {t(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center px-6">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">☀️</span>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] italic">{t('solar_setup')}</label>
                  </div>
                  <button 
                    onClick={() => setSolarConfig(prev => ({ ...prev, isInstalled: !prev.isInstalled }))}
                    className={`w-16 h-9 rounded-full transition-all relative shadow-inner ${solarConfig.isInstalled ? 'bg-eleca-green' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1.5 w-6 h-6 bg-white rounded-full transition-all shadow-[0_5px_15px_rgba(0,0,0,0.3)] ${solarConfig.isInstalled ? 'translate-x-7' : 'translate-x-0'}`} />
                  </button>
                </div>
                {solarConfig.isInstalled && (
                  <div className="space-y-5 animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-eleca-indigo/50 p-10 rounded-[3rem] border border-white/10 shadow-inner">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-[11px] font-black text-white/30 uppercase tracking-widest italic">{t('capacity')}</span>
                        <span className="text-3xl font-[900] text-eleca-green italic drop-shadow-[0_0_10px_#1ED760]">{solarConfig.ratingKw} kW</span>
                      </div>
                      <input 
                        type="range" min="1" max="25" step="0.5" 
                        value={solarConfig.ratingKw} 
                        onChange={(e) => setSolarConfig(prev => ({ ...prev, ratingKw: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none outline-none accent-eleca-green cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] ml-6 italic">{t('subsidy_guard')}</label>
                <div className="grid grid-cols-3 gap-4">
                  {(['none', 'government', 'company'] as SubsidyType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setSubsidyConfig(prev => ({ ...prev, type }))}
                      className={`py-5 rounded-[2rem] text-[9px] font-black uppercase tracking-widest border-2 transition-all spring-transition ${subsidyConfig.type === type ? 'bg-eleca-amber border-eleca-amber text-black shadow-[0_15px_30px_rgba(255,183,3,0.3)]' : 'border-white/5 text-white/30 hover:border-white/20'}`}
                    >
                      {t(type)}
                    </button>
                  ))}
                </div>
                {subsidyConfig.type !== 'none' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <label className="text-[11px] font-black text-white/30 uppercase tracking-widest ml-6 italic">{t('subsidy_limit')}</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={subsidyConfig.limitUnits} 
                        onChange={(e) => setSubsidyConfig(prev => ({ ...prev, limitUnits: parseInt(e.target.value) || 0 }))}
                        className="w-full h-20 bg-eleca-indigo/50 border border-white/10 rounded-[2.5rem] px-10 text-white font-[900] outline-none focus:border-eleca-amber transition-all text-3xl italic shadow-inner"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep('appliances')}
              className="w-full bg-white text-black py-8 rounded-full font-black text-[15px] uppercase tracking-[0.4em] shadow-[0_20px_60px_rgba(0,0,0,0.5)] hover:bg-eleca-green transition-all active:scale-95 italic flex items-center justify-center gap-4 group"
            >
              Continue to Audit
              <span className="group-hover:translate-x-2 transition-transform">➔</span>
            </button>
          </div>
        )}

        {step === 'appliances' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-700">
            <div className="flex justify-between items-end px-6">
              <div>
                <h2 className="text-4xl font-[900] text-white tracking-tighter uppercase italic">{t('inventory_title')}</h2>
                <p className="text-[11px] font-[900] text-white/30 uppercase tracking-[0.5em] mt-3 italic">{t('inventory_subtitle')}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('setup')}
                  className="w-16 h-16 bg-white/5 text-white/60 rounded-[1.8rem] flex items-center justify-center text-2xl border border-white/10 shadow-2xl hover:bg-white/10 hover:text-white transition-all"
                >
                  ⚙️
                </button>
                <button
                  onClick={() => { setEditingAppliance(undefined); setShowAppForm(true); }}
                  className="w-16 h-16 bg-eleca-green text-black rounded-[1.8rem] flex items-center justify-center text-4xl shadow-[0_15px_30px_rgba(30,215,96,0.3)] hover:scale-105 transition-all"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {appliances.length === 0 ? (
                <div className="glass-card p-24 rounded-[4.5rem] text-center opacity-30 border-dashed border-white/10 flex flex-col items-center">
                  <span className="text-8xl mb-10 grayscale brightness-200">🏜️</span>
                  <p className="text-[11px] font-[900] uppercase tracking-[0.6em] italic">Empty Pulse Registry</p>
                </div>
              ) : appliances.map(app => (
                <div key={app.id} onClick={() => handleEditAppliance(app)} className="glass-card p-7 rounded-[3rem] flex items-center gap-8 group cursor-pointer border border-white/5 hover:border-eleca-green/30 hover:bg-white/5 transition-all spring-transition shadow-2xl">
                  <div className="w-18 h-18 bg-eleca-indigo/50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-white/5 group-hover:rotate-12 transition-transform">{app.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-[900] text-white truncate uppercase italic tracking-tight">{app.name}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                       <span className="text-[9px] font-black text-white/30 uppercase tracking-widest italic">{app.watts}W • {app.hoursPerDay}h • {app.quantity} Qty</span>
                       
                       {app.starRating && (
                         <span className="bg-eleca-amber/10 text-eleca-amber px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-eleca-amber/20 shadow-[0_0_10px_rgba(255,183,3,0.1)]">
                           {app.starRating} ★ BEE
                         </span>
                       )}
                       {app.inputMode === 'iseer' && app.iseer && (
                         <span className="bg-eleca-green/10 text-eleca-green px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-eleca-green/20">
                           {app.iseer} ISEER • {app.capacityTon}T
                         </span>
                       )}
                       {app.inputMode === 'eer' && app.eer && (
                         <span className="bg-eleca-green/10 text-eleca-green px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-eleca-green/20">
                           {app.eer} EER • {app.capacityTon}T
                         </span>
                       )}
                       {app.inputMode === 'bee_annual' && app.annualUnits && (
                         <span className="bg-eleca-amber/10 text-eleca-amber px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-eleca-amber/20">
                           {app.annualUnits} kWh/YR
                         </span>
                       )}
                       {app.acType && (
                         <span className="bg-white/5 text-white/40 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10">
                           {app.acType}
                         </span>
                       )}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteAppliance(app.id); }} className="w-12 h-12 flex items-center justify-center text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all text-3xl">&times;</button>
                </div>
              ))}
            </div>

            {appliances.length > 0 && (
              <button
                onClick={() => setStep('bill')}
                className="w-full bg-eleca-green text-black py-8 rounded-full font-black text-[15px] uppercase tracking-[0.4em] shadow-[0_30px_60px_rgba(30,215,96,0.3)] hover:scale-[1.02] transition-all italic flex items-center justify-center gap-4 group"
              >
                {t('generate')}
                <span className="group-hover:translate-x-2 transition-transform">➔</span>
              </button>
            )}
          </div>
        )}

        {step === 'bill' && (
          <Dashboard 
            result={calculationResult as any} 
            stateTariff={stateTariff} 
            language={lang} 
            onNavigate={setStep}
            onSaveToHistory={handleSaveForecast}
          />
        )}

        {step === 'history' && (
          <HistoryView 
            history={history} 
            onDelete={(id) => setHistory(prev => prev.filter(h => h.id !== id))} 
          />
        )}

        {step === 'calendar' && (
          <DailyCalendar 
            logs={dailyLogs} 
            stateTariff={stateTariff} 
            inventory={appliances} 
            subsidyConfig={subsidyConfig} 
            lang={lang} 
            season={season}
            onSaveLog={handleSaveLog}
            onUndoLast={handleUndoLast}
          />
        )}

        {step === 'optimization' && (
          <OptimizationCenter 
            result={calculationResult as any} 
            stateTariff={stateTariff} 
            t={t}
          />
        )}

        {step === 'notifications' && (
          <NotificationCenter 
            notifications={notifications} 
            onNavigate={setStep}
          />
        )}

        {step === 'profile' && profile && (
          <CloudProfileView 
            profile={profile} 
            history={history} 
            onLogout={handleLogout} 
            onDeleteAccount={handleLogout}
            onExportData={() => {}}
          />
        )}
      </main>

      {showAppForm && (
         <div className="fixed inset-0 z-[120] bg-eleca-indigo/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <ApplianceForm 
              lang={lang} 
              onAdd={handleAddAppliance} 
              onCancel={() => setShowAppForm(false)} 
              initialData={editingAppliance}
            />
         </div>
      )}
    </div>
  );
};

export default App;
