'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';

export default function ApiSettingsPage() {
    const t = useTranslations('Settings');
    const locale = useLocale();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        oandaEnvironment: 'practice',
        oandaPracticeAccountId: '',
        oandaPracticeToken: '',
        oandaLiveAccountId: '',
        oandaLiveToken: '',
        openaiApiKey: '',
    });

    useEffect(() => {
        fetch('/api/settings/api-keys')
            .then(res => res.json())
            .then(data => {
                if (data.settings) {
                    setFormData({
                        ...data.settings,
                        // Only update fields that exist in the DB response
                    });
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const res = await fetch('/api/settings/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setMessage({ text: t('success'), type: 'success' });
            } else {
                throw new Error(t('error'));
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setSaving(false);
            // Clear message after 3 seconds
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">{t('tabApi')}</h2>
                <p className="text-gray-400 mt-2">{t('description')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Environment Toggle */}
                <div className="space-y-3 pb-6 border-b border-gray-800">
                    <label className="block text-sm font-medium text-gray-300">{t('environment')}</label>
                    <select
                        name="oandaEnvironment"
                        value={formData.oandaEnvironment}
                        onChange={handleChange}
                        className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="practice">{t('practice')}</option>
                        <option value="live">{t('live')}</option>
                    </select>
                </div>

                {/* Practice Credentials */}
                <div className={`space-y-4 ${formData.oandaEnvironment === 'live' ? 'opacity-50 grayscale' : ''}`}>
                    <h3 className="text-lg font-medium text-blue-400">{t('practice')}</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('practiceAccountId')}</label>
                        <input
                            type="text"
                            name="oandaPracticeAccountId"
                            value={formData.oandaPracticeAccountId}
                            onChange={handleChange}
                            placeholder="101-001-XXXXXXX-001"
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('practiceToken')}</label>
                        <input
                            type="text"
                            name="oandaPracticeToken"
                            value={formData.oandaPracticeToken}
                            onChange={handleChange}
                            placeholder="••••••••••••••••••••••••••••••••"
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-blue-500 font-mono text-sm"
                        />
                    </div>
                </div>

                {/* Live Credentials */}
                <div className={`space-y-4 pt-6 border-t border-gray-800 ${formData.oandaEnvironment === 'practice' ? 'opacity-50 grayscale' : ''}`}>
                    <h3 className="text-lg font-medium text-green-400">{t('live')}</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('liveAccountId')}</label>
                        <input
                            type="text"
                            name="oandaLiveAccountId"
                            value={formData.oandaLiveAccountId}
                            onChange={handleChange}
                            placeholder="001-001-XXXXXXX-001"
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('liveToken')}</label>
                        <input
                            type="text"
                            name="oandaLiveToken"
                            value={formData.oandaLiveToken}
                            onChange={handleChange}
                            placeholder="••••••••••••••••••••••••••••••••"
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-green-500 font-mono text-sm"
                        />
                    </div>
                </div>

                {/* OpenAI Credentials */}
                <div className="space-y-4 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-medium text-purple-400">OpenAI</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('openaiKey')}</label>
                        <input
                            type="text"
                            name="openaiApiKey"
                            value={formData.openaiApiKey}
                            onChange={handleChange}
                            placeholder="sk-••••••••••••••••••••••••••••••••"
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md p-3 focus:ring-purple-500 font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow disabled:opacity-50"
                    >
                        {saving ? '...' : t('save')}
                    </button>

                    {message.text && (
                        <span className={`ml-4 text-sm font-medium ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                            {message.text}
                        </span>
                    )}
                </div>
            </form>
        </div>
    );
}
