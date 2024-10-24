import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  selectedModel: string;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  selectedModel,
  isSidebarOpen,
  toggleSidebar,
}) => {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? "ml-80" : "ml-0"
        }`}
      >
        <Header selectedModel={selectedModel} toggleSidebar={toggleSidebar} />
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
