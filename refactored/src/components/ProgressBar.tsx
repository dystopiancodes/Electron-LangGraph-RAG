import React from "react";

interface ProgressBarProps {
  steps: string[];
  currentStep: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ steps, currentStep }) => {
  return (
    <div className="w-full">
      <div className="flex mb-2">
        {steps.map((step, index) => (
          <div key={index} className="flex-1">
            <div
              className={`h-2 ${
                index <= currentStep ? "bg-blue-500" : "bg-gray-200"
              }`}
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`text-xs ${
              index <= currentStep ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
