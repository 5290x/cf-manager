// NOTE: model-pricing.json 是自动生成的，唯一真实来源在 shared/model-pricing.json
// 修改定价请编辑 shared/model-pricing.json，然后运行 npm run build 或 node scripts/sync-shared.js
import pricingData from '../data/model-pricing.json';

export function estimateNeurons(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens?: number
): number {
  promptTokens = promptTokens || 0;
  completionTokens = completionTokens || 0;
  const cached = cachedTokens || 0;
  const rate = (pricingData.models[model as keyof typeof pricingData.models] ?? pricingData.default) as any;
  const normalInput = Math.max(0, promptTokens - cached);
  const cachedInputRate = rate.cachedInput ?? rate.input;
  const neurons = (normalInput / 1000) * rate.input
                + (cached / 1000) * cachedInputRate
                + (completionTokens / 1000) * rate.output;
  return Math.max(1, Math.round(neurons));
}

/** 图片生成模型的神经元消耗估算（按每张图片计费） */
export function estimateImageNeurons(model: string): number {
  const rate = pricingData.models[model as keyof typeof pricingData.models] as any;
  if (rate?.perImage) return rate.perImage;
  return (pricingData as any).defaultImage?.perImage ?? 1338;
}

/** TTS 模型的神经元消耗估算（按字符数计费） */
export function estimateTtsNeurons(text: string, model: string): number {
  const rate = pricingData.models[model as keyof typeof pricingData.models] as any;
  const perKChar = rate?.perKChar ?? (pricingData as any).defaultTts?.perKChar ?? 30;
  const charCount = text.length;
  return Math.max(1, Math.round((charCount / 1000) * perKChar));
}

/** 翻译模型的神经元消耗估算（按字符数计费） */
export function estimateTranslationNeurons(text: string, model: string): number {
  const charCount = text.length;
  // 翻译模型的定价是按 1000 字符计费，输入和输出价格相同（模型输出翻译文本）
  // CF 翻译模型返回完整翻译文本，按总字符数（输入+输出）计算
  // 为简化，按输入字符数的 2 倍估算（输入 + 输出各约相同长度）
  const rate = (pricingData.models[model as keyof typeof pricingData.models] as any);
  const inputRate = rate?.input ?? (pricingData as any).default?.input ?? 30;
  const outputRate = rate?.output ?? (pricingData as any).default?.output ?? 30;
  // 假设输出和输入长度相近
  const neurons = (charCount / 1000) * (inputRate + outputRate);
  return Math.max(1, Math.round(neurons));
}
