import { memo, useState } from "react";

import MeshSection from "./sections/MeshSection";
import TabsHeader from "./sections/TabsHeader";
import ConfiguratorTab from "./sections/ConfiguratorTab";

const PbrPanel = memo(() => {
    const [activeTab, setActiveTab] = useState('configurator');

    return (
        <aside className="w-[340px] flex-shrink-0 flex flex-col bg-white border-l border-zinc-200">
            <TabsHeader 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === 'meshes' && <MeshSection />}
                
                {activeTab === 'configurator' && <ConfiguratorTab />}
            </div>
        </aside>
    );
});

PbrPanel.displayName = "PbrPanel";
export default PbrPanel;

