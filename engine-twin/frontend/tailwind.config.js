/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'dt-bg':        '#071014',
        'dt-panel':     '#0F1B21',
        'dt-elevated':  '#13232A',
        'dt-border':    '#20343C',
        'dt-text':      '#E8EEF0',
        'dt-muted':     '#8FA1A9',
        'dt-healthy':   '#39D98A',
        'dt-warning':   '#F2B84B',
        'dt-critical':  '#FF5C5C',
        'dt-telemetry': '#55C7E8',
      },
    },
  },
  plugins: [],
}
