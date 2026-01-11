import React, { useState, useEffect, useCallback } from 'react';
import MemeView from './MemeView';
import ProfessionalView from './ProfessionalView';
import { supabase } from './supabaseClient';

const MainApp = () => {
    const [viewMode, setViewMode] = useState('meme'); // 'meme' or 'professional'
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [connectionLegend, setConnectionLegend] = useState([]);

    // Fetch data from Supabase
    const fetchGraphData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch nodes
            const { data: nodesData, error: nodesError } = await supabase
                .from('nodes')
                .select('*');

            if (nodesError) throw nodesError;

            // Fetch edges
            const { data: edgesData, error: edgesError } = await supabase
                .from('edges')
                .select('*');

            if (edgesError) throw edgesError;

            // --- DATA PROCESSING & LEGEND GENERATION ---
            
            // Define meaningful names for different connection colors
            const COLOR_MEANINGS = {
                'orange': 'Political Alliance',
                'green': 'Opposition Network',
                'blue': 'Business Connection',
                'red': 'Rivalry',
                'purple': 'Family Relation',
                'grey': 'Strategic/Advisory',
                'gray': 'Strategic/Advisory',
                'brown': 'Ideological'
            };

            // Count connections by color
            const colorCounts = {};
            edgesData.forEach(link => {
                const color = link.color || '#999';

                if (!colorCounts[color]) {
                    const colorName = COLOR_MEANINGS[color.toLowerCase()] ||
                        color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();

                    colorCounts[color] = {
                        color,
                        type: colorName,
                        count: 0
                    };
                }
                colorCounts[color].count++;
            });

            // Sort by count and get top 5
            const sortedTypes = Object.values(colorCounts)
                .sort((a, b) => b.count - a.count);

            const top5Colors = new Set(sortedTypes.slice(0, 5).map(t => t.color));
            const othersColor = '#666666';

            // Create legend entries
            const legendEntries = sortedTypes.slice(0, 5).map(t => ({
                color: t.color,
                type: t.type,
                count: t.count
            }));

            // Calculate "others" count
            const othersCount = sortedTypes
                .slice(5)
                .reduce((sum, t) => sum + t.count, 0);

            if (othersCount > 0) {
                legendEntries.push({
                    color: othersColor,
                    type: 'Others',
                    count: othersCount
                });
            }

            setConnectionLegend(legendEntries);

            // Update links with top 5 colors or "others"
            const processedLinks = edgesData.map(link => {
                const originalColor = link.color || '#999';
                const finalColor = top5Colors.has(originalColor) ? originalColor : othersColor;

                return {
                    ...link,
                    // Use processed color
                    color: finalColor,
                    originalColor: originalColor, 
                    originalType: link.type
                };
            });

            // Note: We don't clone nodes here because MemeView (ForceGraph) 
            // needs its own mutable copy, while ProfessionalView can use these or clones.
            // We pass raw data mostly, but with processed links.
            setGraphData({ nodes: nodesData, links: processedLinks });

        } catch (error) {
            console.error('Error fetching graph data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* Toggle Control */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '10px 15px',
                borderRadius: '25px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                border: '2px solid rgba(255, 255, 255, 0.2)'
            }}>
                <button
                    onClick={() => setViewMode('meme')}
                    style={{
                        background: viewMode === 'meme' ? '#FF9800' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'meme' ? 'bold' : 'normal',
                        transition: 'all 0.3s ease',
                        fontSize: '14px'
                    }}
                >
                    🎭 Meme View (3D)
                </button>
                <button
                    onClick={() => setViewMode('professional')}
                    style={{
                        background: viewMode === 'professional' ? '#2196F3' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'professional' ? 'bold' : 'normal',
                        transition: 'all 0.3s ease',
                        fontSize: '14px'
                    }}
                >
                    💼 Professional View (2D)
                </button>
            </div>

            {/* Render appropriate view */}
            {viewMode === 'meme' ? (
                <MemeView 
                    data={graphData} 
                    loading={loading} 
                    legend={connectionLegend} 
                />
            ) : (
                <ProfessionalView 
                    data={graphData} 
                    loading={loading} 
                    legend={connectionLegend} 
                />
            )}
        </div>
    );
};

export default MainApp;
