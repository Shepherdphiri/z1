interface AudioVisualizerProps {
  audioLevel: number;
}

export const AudioVisualizer = ({ audioLevel }: AudioVisualizerProps) => {
  return (
    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
      <div 
        className="h-full bg-green-500 rounded-full transition-all duration-150" 
        style={{ width: `${audioLevel}%` }}
      />
    </div>
  );
};
