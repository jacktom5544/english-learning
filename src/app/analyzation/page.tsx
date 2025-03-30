"use client";

import { useState, useEffect } from "react";
import { 
  LineChart, 
  Line, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Label
} from "recharts";
import { addMonths, format } from "date-fns";

// Define the levels and their required hours
const LEVEL_HOURS = {
  "超初級": 0,
  "初級": 500,
  "中級": 1200,
  "中上級": 2200,
  "上級": 4000,
  "準ネイティブ": 10000
};

// Define levels with TOEIC ranges for target
const TARGET_LEVELS = [
  { value: "中級", label: "中級(TOEIC600～799)" },
  { value: "中上級", label: "中上級(TOEIC800～899)" },
  { value: "上級", label: "上級(TOEIC900～)" },
  { value: "準ネイティブ", label: "準ネイティブ(TOEIC990～)" }
];

// All levels for current selection
const ALL_LEVELS = [
  "超初級",
  "初級",
  "中級", 
  "中上級",
  "上級"
];

// Level numeric values for interpolation
const LEVEL_VALUES = {
  "超初級": 0,
  "初級": 1,
  "中級": 2,
  "中上級": 3,
  "上級": 4,
  "準ネイティブ": 5
};

// Custom Y axis mapping
const LEVEL_POINTS = [
  { value: 0, label: "超初級" },
  { value: 1, label: "初級" },
  { value: 2, label: "中級" },
  { value: 3, label: "中上級" },
  { value: 4, label: "上級" },
  { value: 5, label: "準ネイティブ" }
];

export default function AnalyzationPage() {
  const [currentLevel, setCurrentLevel] = useState<string>("超初級");
  const [targetLevel, setTargetLevel] = useState<string>("中級");
  const [hoursPerDay, setHoursPerDay] = useState<number>(2);
  const [chartData, setChartData] = useState<any[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [totalTime, setTotalTime] = useState<{days: number, months: number, years: number, yearsText: string, monthsText: string}>({
    days: 0,
    months: 0,
    years: 0,
    yearsText: "",
    monthsText: ""
  });

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const calculateProgression = () => {
    // Get required hours from current to target level
    const startHours = LEVEL_HOURS[currentLevel as keyof typeof LEVEL_HOURS];
    const targetHours = LEVEL_HOURS[targetLevel as keyof typeof LEVEL_HOURS];
    
    if (targetHours <= startHours) {
      alert("目標レベルは現在のレベルより高くしてください。");
      return;
    }

    const totalHoursNeeded = targetHours - startHours;
    const daysNeeded = Math.ceil(totalHoursNeeded / hoursPerDay);
    const monthsNeeded = +(daysNeeded / 30).toFixed(1);
    const yearsNeeded = +(daysNeeded / 365).toFixed(2);
    
    // Calculate years and months for display
    const fullYears = Math.floor(monthsNeeded / 12);
    const remainingMonths = Math.ceil(monthsNeeded % 12);
    
    const yearsText = fullYears > 0 ? `${fullYears}年` : "";
    const monthsText = remainingMonths > 0 ? `${remainingMonths}ヵ月` : "";

    setTotalTime({
      days: daysNeeded,
      months: monthsNeeded,
      years: yearsNeeded,
      yearsText,
      monthsText
    });

    // Generate chart data - progression by 6-month intervals
    const data = [];
    const today = new Date();
    
    // Find all levels between current and target (including current and target)
    const levels = Object.entries(LEVEL_HOURS)
      .sort((a, b) => a[1] - b[1]);
    
    // Start point - current level
    const startLevelValue = LEVEL_VALUES[currentLevel as keyof typeof LEVEL_VALUES];
    const targetLevelValue = LEVEL_VALUES[targetLevel as keyof typeof LEVEL_VALUES];
    
    data.push({
      time: format(today, "yyyy年MM月"),
      level: currentLevel,
      levelValue: startLevelValue,
      hours: startHours,
      date: today,
      progress: startLevelValue
    });
    
    // Create data points at 6-month intervals
    const endDate = addMonths(today, monthsNeeded);
    let currentDate = today;
    
    // Generate points at 6-month intervals
    while (currentDate < endDate) {
      currentDate = addMonths(currentDate, 6);
      
      if (currentDate > endDate) {
        currentDate = endDate;
      }
      
      // Calculate hours achieved by this date
      const monthsPassed = (currentDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000);
      const hoursAchieved = startHours + (monthsPassed * hoursPerDay * 30);
      
      // Calculate progress as a percentage between current and target hours
      const progressPercent = Math.min(
        (hoursAchieved - startHours) / (targetHours - startHours),
        1
      );
      
      // Interpolate level value
      const exactProgress = startLevelValue + progressPercent * (targetLevelValue - startLevelValue);
      
      // Determine displayed level (the nearest level that's been reached)
      let displayLevel = currentLevel;
      let nearestLevelHours = startHours;
      
      for (const [level, hours] of levels) {
        if (hours <= hoursAchieved && hours > nearestLevelHours) {
          displayLevel = level;
          nearestLevelHours = hours;
        }
      }
      
      data.push({
        time: format(currentDate, "yyyy年MM月"),
        level: displayLevel,
        levelValue: LEVEL_VALUES[displayLevel as keyof typeof LEVEL_VALUES],
        hours: Math.min(hoursAchieved, targetHours),
        date: currentDate,
        progress: exactProgress
      });
      
      // If we've reached the target, break
      if (hoursAchieved >= targetHours) {
        break;
      }
    }
    
    // Make sure final point is exactly at target
    if (data[data.length - 1].hours < targetHours) {
      data.push({
        time: format(endDate, "yyyy年MM月"),
        level: targetLevel,
        levelValue: targetLevelValue,
        hours: targetHours,
        date: endDate,
        progress: targetLevelValue
      });
    }

    setChartData(data);
    setShowResults(true);
  };

  // Custom tick formatter for Y axis
  const formatYAxisTick = (tickItem: number) => {
    const level = LEVEL_POINTS.find(item => item.value === tickItem);
    return level ? level.label : '';
  };

  return (
    <div className="w-full mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">英語レベル分析</h1>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              現在の英語レベル
            </label>
            <select
              value={currentLevel}
              onChange={(e) => setCurrentLevel(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {ALL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              目標の英語レベル
            </label>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {TARGET_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              1日何時間勉強するか？
            </label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <button
          onClick={calculateProgression}
          className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          分析する
        </button>
      </div>
      
      {showResults && (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md w-full">
          <h2 className="text-xl font-semibold mb-4 text-center">分析結果</h2>
          
          <div className="mb-6 text-center">
            <p className="text-lg">
              1日{hoursPerDay}時間の英語学習を行った場合、目標のレベル（{targetLevel}）に到達するには{totalTime.yearsText}{totalTime.monthsText}掛かります。
            </p>
          </div>
          
          {isMobile && (
            <div className="mb-4 flex items-center justify-center text-amber-600 bg-amber-50 p-3 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-2 animate-pulse">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>スマートフォンを横向きにすると、チャートがより見やすくなります</span>
            </div>
          )}
          
          <div className="h-80 sm:h-96 w-full">
            <h3 className="text-lg font-medium mb-3 text-center">学習進捗チャート</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 20, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  name="時期"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                  minTickGap={10}
                >
                  <Label value="学習期間" offset={-5} position="insideBottom" />
                </XAxis>
                <YAxis 
                  domain={[0, 5]}
                  type="number"
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tickFormatter={formatYAxisTick}
                  name="英語レベル" 
                  tick={{ fontSize: 12 }}
                >
                  <Label value="英語レベル" angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip 
                  contentStyle={{ fontSize: '12px' }}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === "現在の英語レベル") {
                      // Find the nearest level
                      const numValue = Number(value);
                      const nearestLevel = LEVEL_POINTS.reduce((prev, curr) => {
                        return Math.abs(curr.value - numValue) < Math.abs(prev.value - numValue) ? curr : prev;
                      });
                      
                      return nearestLevel.label;
                    }
                    return "";  // Hide any other values
                  }}
                  labelFormatter={(label) => {
                    return `時期: ${label}`;
                  }}
                  content={(props) => {
                    if (!props.active || !props.payload || props.payload.length === 0) {
                      return null;
                    }
                    
                    const payload = props.payload[0];
                    const numValue = Number(payload.value);
                    const nearestLevel = LEVEL_POINTS.reduce((prev, curr) => {
                      return Math.abs(curr.value - numValue) < Math.abs(prev.value - numValue) ? curr : prev;
                    });
                    
                    return (
                      <div className="bg-white p-2 border rounded shadow-md">
                        <p className="text-xs mb-1">{`時期: ${props.label}`}</p>
                        <p className="text-xs font-semibold">{`現在の英語レベル: ${nearestLevel.label}`}</p>
                      </div>
                    );
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="progress" 
                  stroke="#8884d8" 
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                  dot={{ r: 4 }}
                  animationDuration={5000}
                  name="現在の英語レベル"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-6">※上記はあくまで概算です。学習の進捗スピードには個人差があります。</p>
        </div>
        
      )}
    </div>
  );
} 