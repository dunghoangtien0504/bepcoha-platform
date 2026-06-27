<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import type { TrendPoint } from '@/api/types';
import { ensureChartsRegistered } from './registerCharts';

ensureChartsRegistered();

const props = defineProps<{ points: TrendPoint[] }>();

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.points.map((point) => point.period),
  datasets: [
    {
      label: 'Token tiêu thụ',
      data: props.points.map((point) => point.tokens),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.15)',
      yAxisID: 'y',
      tension: 0.3,
      fill: true,
    },
    {
      label: 'Chi phí (USD)',
      data: props.points.map((point) => point.costUsd),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.15)',
      yAxisID: 'y1',
      tension: 0.3,
    },
  ],
}));

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    y: { type: 'linear', position: 'left', title: { display: true, text: 'Tokens' } },
    y1: {
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'USD' },
    },
  },
};
</script>

<template>
  <div class="h-72">
    <Line :data="chartData" :options="options" />
  </div>
</template>
