import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

import { useAiChatContext } from '@/components/AiChatNG';

import { NAME_SPACE } from '../../../constants';
import { buildAiAnalyzeContent } from '../utils/aiAnalyze';

interface Props {
  /** 当前日志（AI 分析的输入） */
  log?: Record<string, any>;
  /** 数据源配置的时间字段，用于 AI 分析的 epoch 时间换算标注 */
  timeField?: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** 数据源扩展操作（如 OpenObserve 的「搜索上下文」按钮），渲染在导航按钮之后 */
  children?: React.ReactNode;
}

/**
 * 日志详情抽屉的导航操作区：上一条 / 下一条 / AI 分析。
 * 原始模式（Raw）与表格模式（Table）共用同一实现，保证两种展示模式下
 * 详情弹窗顶部的操作完全一致（表格模式此前后者只有 extraRender，缺导航与 AI 入口）。
 */
export default function LogDetailActions(props: Props) {
  const { t } = useTranslation(NAME_SPACE);
  const { openAiChat } = useAiChatContext();
  const { log, timeField, hasPrev, hasNext, onPrev, onNext, children } = props;

  const handleAiAnalyze = () => {
    if (!log) return;
    // 预处理后再送模型：epoch 时间字段换算为可读时间 + 防编造/分节输出约束。
    // 原始 JSON 直送时模型会自行推算时间戳（实测算错年份并捏造不存在的字段）
    const content = buildAiAnalyzeContent(log, timeField);
    openAiChat({
      initialMessage: t('ai_analyze_prompt', { content }),
    });
  };

  return (
    <span className='flex items-center gap-1'>
      <Button size='small' icon={<LeftOutlined />} disabled={!hasPrev} onClick={onPrev}>
        {t('prev')}
      </Button>
      <Button size='small' icon={<RightOutlined />} disabled={!hasNext} onClick={onNext}>
        {t('next')}
      </Button>
      <Button
        size='small'
        icon={<img src='/image/ai-chat/ai.gif' style={{ width: 14, height: 14, marginRight: 4 }} alt='AI' />}
        onClick={handleAiAnalyze}
      >
        {t('ai_analyze')}
      </Button>
      {children}
    </span>
  );
}
