import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { supabase } from './supabaseClient';

// Group colors configuration
const GROUP_COLORS = {
    govt: '#FF9933',
    opposition: '#00FF00',
    business: '#00BFFF',
    party: '#FFF',
    default: '#ccc'
};

const MemeView = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [connectionLegend, setConnectionLegend] = useState([]);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const fgRef = useRef();

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

            // Transform data
            // react-force-graph expects mutable objects, so we clone
            const nodes = nodesData.map(node => ({ ...node }));

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
                    // Get a meaningful name for this color
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

            // Sort by count and get top 3 (so with Others it makes 4)
            const sortedTypes = Object.values(colorCounts)
                .sort((a, b) => b.count - a.count);

            const topColors = new Set(sortedTypes.slice(0, 3).map(t => t.color));
            const othersColor = '#666666';

            // Create legend entries
            const legendEntries = sortedTypes.slice(0, 3).map(t => ({
                color: t.color,
                type: t.type,
                count: t.count
            }));

            // Calculate "others" count
            const othersCount = sortedTypes
                .slice(3)
                .reduce((sum, t) => sum + t.count, 0);

            if (othersCount > 0) {
                legendEntries.push({
                    color: othersColor,
                    type: 'Others',
                    count: othersCount
                });
            }

            setConnectionLegend(legendEntries);

            // Update links with top 3 colors or "others"
            const links = edgesData.map(link => {
                const originalColor = link.color || '#999';
                const finalColor = topColors.has(originalColor) ? originalColor : othersColor;

                return {
                    ...link,
                    source: link.source,
                    target: link.target,
                    color: finalColor,
                    originalColor: originalColor,
                    originalType: link.type
                };
            });

            setGraphData({ nodes, links });
        } catch (error) {
            console.error('Error fetching graph data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    // Calculate dynamic physics parameters based on number of nodes
    const physicsParams = useMemo(() => {
        const nodeCount = graphData.nodes.length;
        const linkCount = graphData.links.length;

        // More nodes = need more time and slower decay to spread properly
        // Base values for ~20 nodes, scale up as nodes increase
        const baseAlphaDecay = 0.012;
        const baseVelocityDecay = 0.22;
        const baseCooldown = 200;

        // Scale factor based on node count
        const scaleFactor = Math.max(1, nodeCount / 20);

        return {
            alphaDecay: baseAlphaDecay / scaleFactor,
            velocityDecay: baseVelocityDecay / Math.sqrt(scaleFactor),
            cooldownTicks: Math.floor(baseCooldown * scaleFactor)
        };
    }, [graphData.nodes.length, graphData.links.length]);

    // Node Object Customization (Sphere + Text)
    const nodeThreeObject = useCallback((node) => {
        const groupColor = GROUP_COLORS[node.group_type] || GROUP_COLORS.default;
        const sphereSize = node.val ? Math.log(node.val) * 2 + 5 : 5;

        const group = new THREE.Group();

        // Determine if this node should be visible
        let isVisible = true;
        if (selectedNode) {
            const isSelected = node.id === selectedNode.id;
            const isConnected = graphData.links.some(link => {
                const sourceId = link.source.id || link.source;
                const targetId = link.target.id || link.target;
                return (sourceId === selectedNode.id && targetId === node.id) ||
                    (targetId === selectedNode.id && sourceId === node.id);
            });
            isVisible = isSelected || isConnected;
        }

        // 1. Create Sphere with Image Texture
        let material;
        if (node.img) {
            const texture = new THREE.TextureLoader().load(node.img);
            material = new THREE.MeshLambertMaterial({
                map: texture,
                color: 0xffffff,
                transparent: true,
                opacity: isVisible ? 1 : 0.25
            });
        } else {
            material = new THREE.MeshLambertMaterial({
                color: groupColor,
                transparent: true,
                opacity: isVisible ? 1 : 0.25
            });
        }

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereSize, 16, 16),
            material
        );
        group.add(sphere);

        // 2. Add Text Label above the node (formatted as "N. Modi")
        const formatName = (fullName) => {
            const parts = fullName.trim().split(' ');
            if (parts.length <= 1) return fullName;
            const firstInitial = parts[0].charAt(0).toUpperCase();
            const surname = parts[parts.length - 1];
            return `${firstInitial}. ${surname}`;
        };

        const sprite = new SpriteText(formatName(node.name));
        sprite.color = groupColor;
        sprite.textHeight = 4;
        sprite.position.y = sphereSize + 4; // Position above sphere
        // Keep text always visible
        group.add(sprite);

        return group;
    }, [selectedNode, graphData.links]);

    // Node opacity based on selection
    const getNodeOpacity = useCallback((node) => {
        if (!selectedNode) return 1;

        // Selected node is fully visible
        if (node.id === selectedNode.id) return 1;

        // Check if node is connected to selected node
        const isConnected = graphData.links.some(link => {
            const sourceId = link.source.id || link.source;
            const targetId = link.target.id || link.target;
            return (sourceId === selectedNode.id && targetId === node.id) ||
                (targetId === selectedNode.id && sourceId === node.id);
        });

        return isConnected ? 1 : 0.25;
    }, [selectedNode, graphData.links]);

    // Handle Node Click
    const handleNodeClick = useCallback((node) => {
        // Gentle zoom to node (not too close)
        const distance = 150; // Increased for even gentler zoom
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        if (fgRef.current) {
            fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                node, // lookAt
                2000  // Faster transition (2s instead of 3s)
            );
        }

        setSelectedNode(node);
    }, []);

    if (loading) {
        return <div className="loading-container">Loading Influence Graph...</div>;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeThreeObject={nodeThreeObject}
                nodeLabel="name"
                nodeOpacity={getNodeOpacity}
                onBackgroundClick={() => setSelectedNode(null)}


                // Link Styling with neon highlighting
                linkColor={(link) => {
                    if (!selectedNode) return link.color || '#999';

                    // Check if link is connected to selected node
                    const isConnected = link.source.id === selectedNode.id ||
                        link.target.id === selectedNode.id ||
                        link.source === selectedNode.id ||
                        link.target === selectedNode.id;

                    if (!isConnected) return '#444';

                    // Make connected links neon/bright
                    const originalColor = link.color || '#999';
                    const neonMap = {
                        'orange': '#FF8C00',
                        'green': '#00FF00',
                        'blue': '#00D9FF',
                        'red': '#FF0055',
                        'purple': '#FF00FF',
                        'grey': '#FFFFFF',
                        'gray': '#FFFFFF',
                        'brown': '#FFA500'
                    };

                    return neonMap[originalColor.toLowerCase()] || '#FFFFFF';
                }}
                linkWidth={1}
                linkOpacity={(link) => {
                    if (!selectedNode) return 0.6;

                    const isConnected = link.source.id === selectedNode.id ||
                        link.target.id === selectedNode.id ||
                        link.source === selectedNode.id ||
                        link.target === selectedNode.id;

                    return isConnected ? 1 : 0; // Completely invisible
                }}
                linkDirectionalParticles={(link) => {
                    if (!selectedNode) return 2;

                    const isConnected = link.source.id === selectedNode.id ||
                        link.target.id === selectedNode.id ||
                        link.source === selectedNode.id ||
                        link.target === selectedNode.id;

                    return isConnected ? 4 : 0;
                }}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}

                // Interaction
                onNodeClick={handleNodeClick}

                // Physics / Force parameters (dynamic based on node count)
                d3AlphaDecay={physicsParams.alphaDecay}
                d3VelocityDecay={physicsParams.velocityDecay}
                cooldownTicks={physicsParams.cooldownTicks}
                numDimensions={3}
                dagMode={null}

                // Scene config
                backgroundColor={isDarkMode ? "#000000" : "#ffffff"}
                showNavInfo={false}
            />


            {/* Title Overlay */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: isDarkMode ? 'white' : 'black',
                background: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                padding: '10px 20px',
                borderRadius: '8px',
                pointerEvents: 'none'
            }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
                    3D Influence Graph
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>
                    Interactive Network Visualization
                </p>
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: '30px',
                    background: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    color: isDarkMode ? 'white' : 'black',
                    border: `2px solid ${isDarkMode ? 'white' : 'black'}`,
                    padding: '12px 24px',
                    borderRadius: '25px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    pointerEvents: 'auto',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>

            {/* Connection Legend */}
            {connectionLegend.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '110px',
                    left: '20px',
                    color: isDarkMode ? 'white' : 'black',
                    background: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                    padding: '15px',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    maxWidth: '250px'
                }}>
                    <h3 style={{
                        margin: '0 0 10px 0',
                        fontSize: '1rem',
                        fontWeight: 600,
                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                        paddingBottom: '8px'
                    }}>
                        Connection Types
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {connectionLegend.map((entry, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '3px',
                                    backgroundColor: entry.color,
                                    borderRadius: '2px',
                                    flexShrink: 0
                                }} />
                                <span style={{ flex: 1 }}>{entry.type}</span>
                                <span style={{
                                    opacity: 0.7,
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                }}>
                                    ({entry.count})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedNode && (
                <div className="modal-overlay">
                    <button
                        className="close-btn"
                        onClick={() => setSelectedNode(null)}
                    >
                        ×
                    </button>

                    <div className="modal-content">
                        {selectedNode.img && (
                            <img src={selectedNode.img} alt={selectedNode.name} />
                        )}

                        <h2>{selectedNode.name}</h2>

                        <span
                            className="group-badge"
                            style={{
                                color: GROUP_COLORS[selectedNode.group_type] || '#fff',
                                border: `1px solid ${GROUP_COLORS[selectedNode.group_type] || '#fff'}`
                            }}
                        >
                            {selectedNode.group_type?.toUpperCase()}
                        </span>

                        {selectedNode.description && (
                            <p>{selectedNode.description}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MemeView;
