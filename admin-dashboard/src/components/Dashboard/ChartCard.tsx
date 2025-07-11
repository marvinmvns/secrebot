import React from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faExpand, faDownload } from '@fortawesome/free-solid-svg-icons';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

interface ChartCardProps {
  title: string;
  data: any;
  type: 'line' | 'bar' | 'doughnut';
  height?: number;
  variant?: 'default' | 'glass' | 'neuma';
  showActions?: boolean;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  type,
  height = 300,
  variant = 'default',
  showActions = true,
}) => {
  const getCardClasses = () => {
    let classes = 'dashboard-card chart-card';
    
    switch (variant) {
      case 'glass':
        classes += ' dashboard-card--glass';
        break;
      case 'neuma':
        classes += ' dashboard-card--neuma';
        break;
      default:
        break;
    }
    
    return classes;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            family: 'Inter, sans-serif',
          },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: type !== 'doughnut' ? {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 11,
            family: 'Inter, sans-serif',
          },
          color: 'var(--text-muted)',
        },
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 11,
            family: 'Inter, sans-serif',
          },
          color: 'var(--text-muted)',
        },
        beginAtZero: true,
      },
    } : {},
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2,
      },
      line: {
        borderWidth: 3,
      },
    },
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return <Line data={data} options={chartOptions} />;
      case 'bar':
        return <Bar data={data} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={data} options={chartOptions} />;
      default:
        return <Line data={data} options={chartOptions} />;
    }
  };

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">{title}</h3>
        {showActions && (
          <div className="dashboard-card__header__actions">
            <motion.button
              className="dashboard-card__header__action"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Download Chart"
            >
              <FontAwesomeIcon icon={faDownload} />
            </motion.button>
            <motion.button
              className="dashboard-card__header__action"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Expand Chart"
            >
              <FontAwesomeIcon icon={faExpand} />
            </motion.button>
            <motion.button
              className="dashboard-card__header__action"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="More Options"
            >
              <FontAwesomeIcon icon={faEllipsisV} />
            </motion.button>
          </div>
        )}
      </div>
      
      <div className="chart-card__content" style={{ height }}>
        {renderChart()}
      </div>
    </motion.div>
  );
};

export default ChartCard;