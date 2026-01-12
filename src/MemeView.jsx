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

const MemeView = ({ data, loading, legend }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [selectedNode, setSelectedNode] = useState(null);
    // connectionLegend is now passed as prop 'legend'
    const fgRef = useRef();

    useEffect(() => {
        if (data && data.nodes.length > 0) {
            // react-force-graph expects mutable objects, so we clone strictly for this view
            const nodes = data.nodes.map(node => ({ ...node }));
            const links = data.links.map(link => ({
                ...link,
                // Ensure source/target match node IDs (if they were already objects from previous render, reset to IDs if needed, 
                // but MainApp passes raw IDs or processed objects? MainApp passes processed objects but source/target are likely still IDs unless processed.
                // MainApp just mapped edgesData. So source/target are IDs/Strings.
                // However, if we switch views, we are getting fresh props from MainApp.
                source: link.source, 
                target: link.target
            }));
            
            setGraphData({ nodes, links });
        }
    }, [data]);

    // Node Object Customization (Sphere + Text)
    const nodeThreeObject = useCallback((node) => {
        const groupColor = GROUP_COLORS[node.group_type] || GROUP_COLORS.default;
        const sphereSize = node.val ? Math.log(node.val) * 2 + 5 : 5; // Scale size by importance

        const group = new THREE.Group();

        // 1. Create Sphere with Image Texture
        let material;
        if (node.img) {
            const texture = new THREE.TextureLoader().load(node.img);
            material = new THREE.MeshLambertMaterial({
                map: texture,
                color: 0xffffff
            });
        } else {
            material = new THREE.MeshLambertMaterial({ color: groupColor });
        }

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereSize, 16, 16),
            material
        );
        group.add(sphere);

        // 2. Add Text Label above the node
        const sprite = new SpriteText(node.name);
        sprite.color = groupColor;
        sprite.textHeight = 4;
        sprite.position.y = sphereSize + 4; // Position above sphere
        group.add(sprite);

        return group;
    }, []);

    // Handle Node Click
    const handleNodeClick = useCallback((node) => {
        // 1. Aim at node from outside it
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        if (fgRef.current) {
            fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                node, // lookAt
                3000  // ms transition duration
            );
        }

        // 2. Set selected node for Modal
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

                // Link Styling
                linkColor={(link) => link.originalColor || link.color || '#999'}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={1}

                // Interaction
                onNodeClick={handleNodeClick}

                // Physics / Force parameters to increase node spacing
                d3AlphaDecay={0.01}
                d3VelocityDecay={0.2}
                cooldownTicks={200}
                numDimensions={3}
                dagMode={null}

                // Scene config
                backgroundColor="#000000"
                showNavInfo={false}
            />

            {/* Title Overlay */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: 'white',
                background: 'rgba(0,0,0,0.5)',
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

            {/* Connection Legend */}
            {legend.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '110px',
                    left: '20px',
                    color: 'white',
                    background: 'rgba(0,0,0,0.7)',
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
                        {legend.map((entry, idx) => (
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
