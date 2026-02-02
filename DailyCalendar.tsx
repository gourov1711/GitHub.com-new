
import React, { useMemo, useState, useEffect } from 'react';
import { UserDailyUsage, Language, StateTariff, Appliance, MonthlyUsageSummary, SubsidyConfig, Season } from './types';
import { translations } from './translations';
import { calculateProgressiveBill, calculateApplianceUnits } from './utils/calculator';
import DayEditor from './components/DayEditor';

interface Props {
  logs: UserDailyUsage[];
  stateTariff: StateTariff;
  inventory: Appliance[];
  subsidyConfig: SubsidyConfig;
  lang: Language;
  season: Season;
  onSaveLog: (log: UserDailyUsage) => void;
  onUndoLast?: () => void;
}

const DailyCalendar: React.FC<Props> = ({ logs, stateTariff, inventory, subsidyConfig, lang, season, onSaveLog, onUndoLast }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const t = (key: string) => translations[lang]?.[key] || translations['en']?.[key] || key;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const monthLogs = useMemo(() => 
    logs.filter(l => l.date.startsWith(currentMonth)).sort((a,b) => a.date.localeCompare(b.date)),
  [logs, currentMonth]);

  const summary = useMemo(() => {
    const totalUnits = monthLogs.reduce((sum, l) => sum + l.totalUnits, 0);
    const daysLogged = monthLogs.length;
    
    const baselineDaily = inventory.reduce((sum, a) => sum + (calculateApplianceUnits(a, season) / 30), 0);
    const avgUnitsPerDay = daysLogged > 0 ? totalUnits / daysLogged : baselineDaily;
    const projectedUnits = avgUnitsPerDay * daysInMonth;
    
    const isStabilized = daysLogged >= 7;
    const confidenceScore = daysLogged >= 10 ? Math.min(99, 65 + (daysLogged / daysInMonth) * 35) : null;

    const projectedBillTotal = calculateProgressiveBill(projectedUnits, stateTariff);
    const mtdBillCost = calculateProgressiveBill(totalUnits, stateTariff);
    /* Fix: Arithmetic operation on objects is prohibited; access .total property for numeric calculation */
    const estRemainderCost = Math.max(0, projectedBillTotal.total - mtdBillCost.total);

    return {
      month: currentMonth,
      totalUnits,
      /* Fix: Assign the total numeric value from the billing object */
      totalCost: mtdBillCost.total,
      subsidyLimit: subsidyConfig.limitUnits,
      subsidyUsed: Math.min(totalUnits, subsidyConfig.limitUnits),
      slabCrossed: totalUnits > subsidyConfig.limitUnits,
      /* Fix: Assign the total numeric value from the billing object */
      projectedBill: projectedBillTotal.total,
      projectedUnits,
      confidenceScore,
      isStabilized,
      estRemainderCost
    };
  }, [monthLogs, stateTariff, inventory, daysInMonth, currentMonth, subsidyConfig, season]);

  const calendarDays = useMemo(() => {
    const days = [];
    let cumulativeUnits = 0;
    const limit = subsidyConfig.limitUnits || Infinity;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentMonth}-${i.toString().padStart(2, '0')}`;
      const log = monthLogs.find(l => l.date === dateStr);
      const isPast = new Date(dateStr) < new Date(new Date().setHours(0,0,0,0));
      
      if (log) {
        cumulativeUnits += log.totalUnits;
      }

      let status: 'safe' | 'warning' | 'critical' | 'none' = 'none';
      if (log) {
        if (cumulativeUnits >= limit) status = 'critical';
        else if (cumulativeUnits >= 0.85 * limit) status = 'warning';
        else status = 'safe';
      }

      days.push({ 
        date: dateStr, 
        dayNum: i, 
        log, 
        status, 
        isFuture: new Date(dateStr) > new Date(),
        isEstimated: isPast && !log
      });
    }
    return days;
  }, [currentMonth, daysInMonth, monthLogs, subsidyConfig]);

  const getStatusClass = (status: string, isFuture: boolean, isEstimated: boolean) => {
    if (isFuture) return 'bg-white/5 border-dashed border-white/10 text-white/5 cursor-not-allowed opacity-20';
    if (isEstimated) return 'bg-eleca-amber/5 border-dashed border-eleca-amber/30 text-eleca-amber/40 ring-1 ring-eleca-amber/10';
    
    switch(status) {
      case 'critical': return 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_15px_30px_rgba(244,63,94,0.1)] scale-105 z-10';
      case 'warning': return 'bg-eleca-amber/20 border-eleca-amber/50 text-eleca-amber shadow-[0_15px_30px_rgba(255,183,3,0.1)]';
      case 'safe': return 'bg-eleca-green/20 border-eleca-green/50 text-eleca-green shadow-[0_15px_30px_rgba(30,215,96,0.15)]';
      default: return 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20';
    }
  };

  return (
    <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-700 pb-20">
      <div className="glass-card p-12 sm:p-14 rounded-[4.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-eleca-green/5 rounded-full blur-[120px] -translate-y-32 translate-x-32 group-hover:scale-110 transition-transform duration-[6s]" />
        
        <div className="relative z-10 flex flex-col gap-16">
          <div className="flex justify-between items-start">
            <div className="space-y-4">
              <p className="text-[11px] font-[900] text-eleca-green uppercase tracking-[0.6em] italic opacity-80">{t('mtd_total')}</p>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-[900] text-white/20 italic">₹</span>
                <h3 className="text-7xl sm:text-8xl font-[900] tracking-tighter italic text-white leading-none drop-shadow-2xl">{summary.totalCost.toFixed(0)}</h3>
              </div>
            </div>
            <div className="flex flex-col items-end gap-5">
              <span className={`px-6 py-3 rounded-[1.8rem] text-[10px] font-[900] uppercase tracking-[0.3em] shadow-2xl flex items-center gap-3 italic ${summary.isStabilized ? 'bg-eleca-green text-black glow-green' : 'bg-white/5 text-white/30 border border-white/10 animate-pulse'}`}>
                {summary.isStabilized ? 'STABILIZED' : 'CALIBRATING'}
              </span>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-14">
            <p className="text-[11px] font-[900] text-eleca-amber uppercase tracking-[0.6em] italic opacity-80">{t('projected')}</p>
            <div className="flex items-baseline gap-5">
              <span className="text-6xl font-[900] text-eleca-amber italic drop-shadow-[0_0_20px_rgba(255,183,3,0.5)]">₹</span>
              <h3 className="text-8xl sm:text-9xl font-[900] tracking-tighter italic text-white leading-none drop-shadow-2xl">{summary.projectedBill.toFixed(0)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-12 sm:p-14 rounded-[4.5rem] border border-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.4)] min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-16 px-4 gap-8">
          <h2 className="text-3xl font-[900] text-white tracking-tighter uppercase italic leading-none">Journal Grid</h2>
        </div>
        
        <div className="grid grid-cols-7 gap-5 sm:gap-10">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-[900] text-white/10 uppercase py-4 tracking-[0.3em]">{d}</div>
          ))}
          {calendarDays.map((day) => (
            <button 
              key={day.date}
              disabled={day.isFuture}
              onClick={() => setSelectedDate(day.date)}
              className={`aspect-square rounded-[2.2rem] flex flex-col items-center justify-center transition-all border-2 relative group spring-transition ${getStatusClass(day.status, day.isFuture, day.isEstimated)}`}
            >
              <span className={`text-[14px] font-[900] group-hover:scale-125 transition-transform ${day.isFuture ? '' : 'italic'}`}>{day.dayNum}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-[200] bg-eleca-indigo/95 backdrop-blur-3xl flex items-end sm:items-center justify-center p-6 animate-in fade-in duration-500">
          <DayEditor 
            date={selectedDate} 
            inventory={inventory} 
            existingLog={logs.find(l => l.date === selectedDate)}
            prevLog={logs.find(l => l.date === new Date(new Date(selectedDate).getTime() - 86400000).toISOString().slice(0, 10))}
            lang={lang}
            stateTariff={stateTariff}
            season={season}
            onSave={(log) => { onSaveLog(log); setSelectedDate(null); }}
            onCancel={() => setSelectedDate(null)}
          />
        </div>
      )}
    </div>
  );
};

export default DailyCalendar;
