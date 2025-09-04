import React, { useState, useEffect } from 'react';
import cloudApi from '../services/cloudApi';

interface SubscriptionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubscription?: any;
}

const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({ 
  isOpen, 
  onClose, 
  currentSubscription 
}) => {
  const [tiers, setTiers] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [tiersData, usageData] = await Promise.all([
        cloudApi.getSubscriptionTiers(),
        cloudApi.getUsageAnalytics()
      ]);
      setTiers(tiersData);
      setUsage(usageData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load subscription data');
    }
  };

  const handleUpgrade = async (tier: string) => {
    setLoading(true);
    setError('');

    try {
      if (currentSubscription?.tier === 'TRIAL') {
        await cloudApi.createSubscription(tier);
      } else {
        await cloudApi.updateSubscription(tier);
      }
      
      // Refresh subscription data
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upgrade failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;

    setLoading(true);
    try {
      await cloudApi.cancelSubscription(true);
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Cancellation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentTier = currentSubscription?.tier || 'TRIAL';

  return (
    <div className="subscription-panel-overlay" onClick={onClose}>
      <div className="subscription-panel" onClick={e => e.stopPropagation()}>
        <div className="subscription-header">
          <h2>Manage Subscription</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Current Usage */}
        {currentSubscription && usage && (
          <div className="usage-summary">
            <h3>Current Usage</h3>
            <div className="usage-stats">
              <div className="usage-item">
                <span className="usage-label">Automations Used:</span>
                <span className="usage-value">
                  {currentSubscription.automationsUsed} / {
                    currentSubscription.automationsLimit === -1 
                      ? '∞' 
                      : currentSubscription.automationsLimit
                  }
                </span>
              </div>
              <div className="usage-item">
                <span className="usage-label">Status:</span>
                <span className={`usage-value status-${currentSubscription.status.toLowerCase()}`}>
                  {currentSubscription.status}
                </span>
              </div>
              {currentSubscription.billingPeriodEnd && (
                <div className="usage-item">
                  <span className="usage-label">
                    {currentSubscription.status === 'TRIAL' ? 'Trial Ends:' : 'Next Billing:'}
                  </span>
                  <span className="usage-value">
                    {new Date(currentSubscription.billingPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Tiers */}
        <div className="subscription-tiers">
          <h3>Available Plans</h3>
          <div className="tiers-grid">
            {Object.entries(tiers).map(([tierKey, tier]: [string, any]) => (
              <div 
                key={tierKey}
                className={`tier-card ${currentTier === tierKey ? 'current' : ''}`}
              >
                <div className="tier-header">
                  <h4>{tier.name}</h4>
                  <div className="tier-price">
                    {tier.monthlyPrice === 0 ? (
                      'Free'
                    ) : (
                      <>
                        <span className="price">${tier.monthlyPrice}</span>
                        <span className="period">/month</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="tier-features">
                  {tier.features.map((feature: string, index: number) => (
                    <div key={index} className="feature">
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="tier-actions">
                  {currentTier === tierKey ? (
                    <div className="current-plan">Current Plan</div>
                  ) : tierKey === 'TRIAL' ? (
                    <div className="trial-info">Free Trial</div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(tierKey)}
                      disabled={loading}
                      className="upgrade-button"
                    >
                      {loading ? 'Processing...' : 
                        currentTier === 'TRIAL' ? 'Start Subscription' : 'Switch Plan'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Subscription */}
        {currentSubscription?.status === 'ACTIVE' && (
          <div className="cancel-section">
            <h4>Cancel Subscription</h4>
            <p>Your subscription will remain active until the end of your current billing period.</p>
            <button 
              onClick={handleCancel}
              disabled={loading}
              className="cancel-button"
            >
              Cancel Subscription
            </button>
          </div>
        )}

        {/* Usage Analytics Link */}
        <div className="analytics-section">
          <button 
            onClick={() => {
              // Open usage analytics modal/page
              console.log('Open usage analytics');
            }}
            className="analytics-button"
          >
            View Detailed Analytics →
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPanel;