import React from 'react';
import { Info } from 'lucide-react';

interface InfoWithTooltipProps {
  title: string;
  className?: string;
}

const InfoWithTooltip: React.FC<InfoWithTooltipProps> = ({ title, className }) => {
  return (
    <span title={title}>
      <Info className={className} />
    </span>
  );
};

export default InfoWithTooltip;
