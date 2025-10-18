/**
 * VU Meter Component
 * 
 * Visual audio level meter for monitoring input/output levels
 */

import { useEffect, useRef } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  width?: number;
  height?: number;
  showPeakIndicator?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export default function VUMeter({ 
  level, 
  width = 200, 
  height = 20,
  showPeakIndicator = true,
  orientation = 'horizontal'
}: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakLevelRef = useRef<number>(0);
  const peakHoldTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Update peak level with hold time
    const now = Date.now();
    if (level > peakLevelRef.current) {
      peakLevelRef.current = level;
      peakHoldTimeRef.current = now + 1000; // Hold for 1 second
    } else if (now > peakHoldTimeRef.current) {
      peakLevelRef.current = level;
    }

    const isHorizontal = orientation === 'horizontal';
    const maxDimension = isHorizontal ? width : height;

    // Calculate fill length based on level
    const fillLength = (level / 100) * maxDimension;

    // Create gradient (green -> yellow -> red)
    const gradient = isHorizontal
      ? ctx.createLinearGradient(0, 0, width, 0)
      : ctx.createLinearGradient(0, height, 0, 0);

    gradient.addColorStop(0, '#22c55e');    // Green
    gradient.addColorStop(0.6, '#22c55e');  // Green
    gradient.addColorStop(0.75, '#eab308'); // Yellow
    gradient.addColorStop(0.9, '#f97316');  // Orange
    gradient.addColorStop(1, '#ef4444');    // Red

    // Draw background (dark gray)
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 0, width, height);

    // Draw level meter
    ctx.fillStyle = gradient;
    if (isHorizontal) {
      ctx.fillRect(0, 0, fillLength, height);
    } else {
      ctx.fillRect(0, height - fillLength, width, fillLength);
    }

    // Draw peak indicator
    if (showPeakIndicator && peakLevelRef.current > 0) {
      const peakPosition = (peakLevelRef.current / 100) * maxDimension;
      ctx.fillStyle = '#ffffff';
      
      if (isHorizontal) {
        ctx.fillRect(peakPosition - 2, 0, 2, height);
      } else {
        ctx.fillRect(0, height - peakPosition - 2, width, 2);
      }
    }

    // Draw scale marks (every 10%)
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let i = 10; i < 100; i += 10) {
      const position = (i / 100) * maxDimension;
      
      if (isHorizontal) {
        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, height);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, height - position);
        ctx.lineTo(width, height - position);
        ctx.stroke();
      }
    }

  }, [level, width, height, showPeakIndicator, orientation]);

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        className="rounded"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          imageRendering: 'crisp-edges'
        }}
      />
    </div>
  );
}

