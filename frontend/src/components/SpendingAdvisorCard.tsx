import React, { useState, useEffect } from 'react';
import { StatsSummary, AdvisorExplanation } from '../types';
import { fetchStatsSummary, fetchAdvisorExplanation } from '../api/client';
import { Lightbulb, TrendingUp } from 'lucide-react';

interface SpendingAdvisorCardProps {
  currentMonth: string;
}

export const SpendingAdvisorCard: React.FC<SpendingAdvisorCardProps> = ({ currentMonth }) => {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [advisorData, setAdvisorData] = useState<AdvisorExplanation | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingAdvisor, setLoadingAdvisor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      setError(null);
      setAdvisorData(null);
      const res = await fetchStatsSummary(currentMonth);
      setStats(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load spending stats');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingStats(true);
        setError(null);
        setAdvisorData(null);
        const res = await fetchStatsSummary(currentMonth);
        if (!cancelled) setStats(res);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load spending stats');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentMonth]);

  const handleGenerateAdvice = async () => {
    try {
      setLoadingAdvisor(true);
      setError(null);
      const res = await fetchAdvisorExplanation(currentMonth, stats || undefined);
      setAdvisorData(res.advisorExplanation);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI advice');
    } finally {
      setLoadingAdvisor(false);
    }
  };

  if (loadingStats) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
        Computing spending analytics for {currentMonth}...
      </div>
    );
  }

  const momVal = stats ? stats.totalMomPercentageChange : 0;
  const prevMonthAmt = stats ? stats.totalPreviousMonthSpend : 0;
  const currMonthAmt = stats ? stats.totalCurrentMonthSpend : 0;
  const topCatName = stats && stats.topCategory && currMonthAmt > 0 ? stats.topCategory.name : '-';

  return (
    <div className="card" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Spending Advisor & Stats Engine
          </h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Insights based on your spending data
          </div>
        </div>

        <button
          className="btn btn-outline-white"
          onClick={handleGenerateAdvice}
          disabled={loadingAdvisor}
          style={{ fontSize: '12px' }}
        >
          <TrendingUp size={14} className={loadingAdvisor ? 'spin' : ''} />
          {loadingAdvisor ? 'Analyzing...' : 'Generate Insights'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecdd3', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 2 Inner Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Inner Card 1: Month-over-Month Change */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Month-over-Month Change
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
            {momVal > 0 ? `+${momVal}%` : `${momVal}%`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {momVal === 0 ? 'No change from last month' : momVal > 0 ? 'Increase from last month' : 'Decrease from last month'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Prev Month: ₹{prevMonthAmt.toFixed(2)} • Current Month: ₹{currMonthAmt.toFixed(2)}
          </div>
        </div>

        {/* Inner Card 2: Top Spending Category */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Top Spending Category
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#b45309', marginBottom: '4px' }}>
            {topCatName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {topCatName === '-' ? 'No expenses recorded this month' : `Highest outlay this month`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Track expenses to see insights
          </div>
        </div>
      </div>

      {/* AI Advice Output Container */}
      {advisorData && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.06) 0%, rgba(99, 102, 241, 0.06) 100%)',
            border: '1px solid rgba(15, 118, 110, 0.2)',
            borderRadius: '10px',
            padding: '18px 20px',
            marginTop: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-teal)', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
            Gemini 1.5 Flash Advice
          </div>
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '12px' }}>
            {advisorData.explanation}
          </p>
          {advisorData.actionableTips && advisorData.actionableTips.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Action Items:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {advisorData.actionableTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
