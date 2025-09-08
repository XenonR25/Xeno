'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiService } from '@/lib/api';
import toast from 'react-hot-toast';
import { LightBulbIcon } from '@heroicons/react/24/outline';

interface ModelItem {
  ModelId: number;
  ModelName: string;
  Description: string;
}

export default function CategoryForm() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelId, setModelId] = useState<number | ''>('');
  const [promptText, setPromptText] = useState('');

  const formValid = useMemo(() => {
    return name.trim().length > 0 && description.trim().length > 0 && !!modelId && promptText.trim().length > 0;
  }, [name, description, modelId, promptText]);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.ModelId === modelId);
  }, [models, modelId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingModels(true);
        const data = await apiService.getModels();
        const allowed = ['openai','gemini','deepseek','claude'];
        const filtered = (data.models || []).filter((m: ModelItem) => allowed.includes(m.ModelName.toLowerCase()));
        setModels(filtered);
      } catch (err: any) {
        console.error('Failed to load models', err);
        toast.error(`Failed to load models${err?.message ? `: ${err.message}` : ''}`);
      } finally {
        setLoadingModels(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      toast.loading('Creating prompt...', { id: 'cat' });
      const prompt = await apiService.createPrompt(promptText.trim());
      toast.loading('Creating category...', { id: 'cat' });
      const category = await apiService.createCategory({
        Name: name.trim(),
        Description: description.trim(),
        ModelId: Number(modelId),
        PromptId: prompt.PromptId,
      });
      toast.success(`Category created (ID: ${category.CategoryId})`, { id: 'cat' });
      // reset form
      setName('');
      setDescription('');
      setModelId('');
      setPromptText('');
    } catch (err: any) {
      console.error('Create category error', err);
      toast.error(`Failed to create category${err?.message ? `: ${err.message}` : ''}`, { id: 'cat' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-white mb-2">Create Category</h1>
        <p className="text-sm text-gray-400 mb-6">Combine an AI model with a custom prompt to create a category. The returned CategoryId will be used later.</p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summarization"
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Model</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>
                  {loadingModels ? 'Loading models...' : 'Select a model (OpenAI, Gemini, DeepSeek, Claude)'}
                </option>
                {models.map((m) => (
                  <option key={m.ModelId} value={m.ModelId} title={m.Description}>
                    {m.ModelName}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <div className="mt-2 rounded-lg border border-dashed border-yellow-500/40 bg-gradient-to-r from-gray-900 to-gray-800 p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-yellow-400">
                      <LightBulbIcon className="h-5 w-5" />
                    </div>
                    <div className="text-xs md:text-sm leading-relaxed">
                      <div className="mb-1 font-medium text-white tracking-wide">{selectedModel.ModelName}</div>
                      <p className="italic text-gray-300">{selectedModel.Description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this category"
              rows={3}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Prompt</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the prompt to guide the model"
              rows={4}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="mt-1 text-xs text-gray-400">A prompt record will be created and linked to this category.</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={!formValid}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              Create Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
