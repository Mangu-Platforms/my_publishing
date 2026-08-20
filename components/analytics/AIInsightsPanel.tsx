/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';
import { getAIInsights } from '@/lib/actions/ai-insights';
import type { DateRange } from '@/types/analytics';
import type { BookStats, HeatmapData } from '@/types/analytics';

interface AIInsightsPanelProps {
  bookId: string;
  dateRange: DateRange;
  stats: BookStats[];
  heatmap: HeatmapData[];
}

interface Insight {
  type: 'performance' | 'engagement' | 'recommendation' | 'prediction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  icon: React.ReactNode;
}

export default function AIInsightsPanel({
  bookId,
  dateRange,
  stats,
  heatmap,
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    generateInsights();
  }, [bookId, dateRange, stats, heatmap]);

  const generateInsights = async () => {
    try {
      setLoading(true);
      const aiInsights = await getAIInsights(bookId, stats, heatmap);

      const formattedInsights: Insight[] = [];

      // Performance insights
      if (aiInsights.performance.trends.views > 0.1) {
        formattedInsights.push({
          type: 'performance',
          priority: 'high',
          title: 'Strong Growth Trend',
          description: `Views are growing at ${(aiInsights.performance.trends.views * 100).toFixed(1)}% daily. Keep up the momentum!`,
          icon: <TrendingUp className="h-5 w-5 text-green-500" />,
        });
      }

      if (aiInsights.performance.patterns.includes('weekend_peak')) {
        formattedInsights.push({
          type: 'performance',
          priority: 'medium',
          title: 'Weekend Peak Detected',
          description:
            'Your book performs 20% better on weekends. Schedule promotions accordingly.',
          icon: <Clock className="h-5 w-5 text-blue-500" />,
        });
      }

      // Engagement insights from heatmap
      if (aiInsights.engagement.dropOffPoints.length > 0) {
        formattedInsights.push({
          type: 'engagement',
          priority: 'high',
          title: 'High Drop-off Points',
          description: `Chapters ${aiInsights.engagement.dropOffPoints.join(', ')} have significant reader drop-off.`,
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        });
      }

      // Recommendations
      aiInsights.recommendations.forEach((rec) => {
        formattedInsights.push({
          type: 'recommendation',
          priority: rec.priority as 'high' | 'medium' | 'low',
          title: rec.type.replace('_', ' ').toUpperCase(),
          description: rec.message,
          action: rec.action
            ? {
                label: 'Take Action',
                href: rec.action,
              }
            : undefined,
          icon: <Lightbulb className="h-5 w-5 text-yellow-500" />,
        });
      });

      // Predictions
      if (aiInsights.predictions) {
        formattedInsights.push({
          type: 'prediction',
          priority: 'medium',
          title: 'Growth Forecast',
          description: `Expected ${aiInsights.predictions.nextWeekViews.toLocaleString()} views next week.`,
          icon: <Target className="h-5 w-5 text-purple-500" />,
        });
      }

      setInsights(formattedInsights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance':
        return 'bg-blue-50 text-blue-700';
      case 'engagement':
        return 'bg-green-50 text-green-700';
      case 'recommendation':
        return 'bg-purple-50 text-purple-700';
      case 'prediction':
        return 'bg-orange-50 text-orange-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const displayedInsights = expanded ? insights : insights.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle>AI Insights</CardTitle>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Powered by AI
          </Badge>
        </div>
        <CardDescription>Actionable insights based on your analytics data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayedInsights.map((insight, index) => (
            <div key={index} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-start gap-3">
                <div className="mt-1">{insight.icon}</div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={getTypeColor(insight.type)}>
                      {insight.type.toUpperCase()}
                    </Badge>
                  </div>
                  <h4 className="mb-1 font-semibold">{insight.title}</h4>
                  <p className="mb-3 text-sm text-muted-foreground">{insight.description}</p>
                  {insight.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (window.location.href = insight.action!.href)}
                    >
                      {insight.action.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {insights.length > 3 && (
            <Button variant="ghost" className="w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show Less' : `Show ${insights.length - 3} More Insights`}
            </Button>
          )}

          {insights.length === 0 && (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <p className="text-muted-foreground">
                All systems optimal. No critical insights at this time.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
