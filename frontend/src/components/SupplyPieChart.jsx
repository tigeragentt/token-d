import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function SupplyPieChart({ sepoliaRaw, xdcRaw }) {
  const s = Number(sepoliaRaw || 0n)
  const x = Number(xdcRaw || 0n)
  const total = s + x

  const data = {
    labels: ['Sepolia', 'XDC Apothem'],
    datasets: [
      {
        data: total > 0 ? [s, x] : [1, 1],
        backgroundColor: ['rgba(79,163,255,0.8)', 'rgba(62,207,142,0.8)'],
        borderColor: ['#4fa3ff', '#3ecf8e'],
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e2e4f0',
          font: { size: 12 },
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const raw = ctx.raw
            const pct = total > 0 ? ((raw / total) * 100).toFixed(1) : '0'
            const val = (raw / 100).toFixed(2)
            return ` ${val} Deb1 (${pct}%)`
          },
        },
      },
    },
  }

  return <Pie data={data} options={options} />
}
