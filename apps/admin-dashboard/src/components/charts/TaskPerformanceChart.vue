<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import type { TaskPerformance } from '@/api/types';
import { ensureChartsRegistered } from './registerCharts';

ensureChartsRegistered();

const props = defineProps<{ tasks: TaskPerformance[] }>();

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.tasks.map((task) => task.taskId),
  datasets: [
    {
      label: 'Giờ ước tính thủ công (T_baseline)',
      data: props.tasks.map((task) => task.baselineHours),
      backgroundColor: '#94a3b8',
    },
    {
      label: 'Giờ thực tế với AI (T_actual)',
      data: props.tasks.map((task) => task.actualHours),
      backgroundColor: '#4f46e5',
    },
  ],
}));

const options: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: false },
    y: { stacked: false, title: { display: true, text: 'Giờ công' } },
  },
};
</script>

<template>
  <div class="h-72">
    <Bar :data="chartData" :options="options" />
  </div>
</template>
