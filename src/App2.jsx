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

const App = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
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
            const links = edgesData.map(link => ({
                ...link,
                // Ensure source/target match node IDs
                source: link.source,
                target: link.target
            }));

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

    // Node Object Customization (Sphere + Text)
    const nodeThreeObject = useCallback((node) => {
        const groupColor = GROUP_COLORS[node.group_type] || GROUP_COLORS.default;
        const sphereSize = node.val ? Math.log(node.val) * 2 + 5 : 5; // Scale size by importance

        const group = new THREE.Group();

        // 1. Create Object (Sprite if image, Sphere if solid color)
        if (node.img) {
            const texture = new THREE.TextureLoader().load(node.img);
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            // Scale sprite: sphereSize was radius, so diameter is approx 2x. 
            // We scale slightly larger for better visibility.
            sprite.scale.set(sphereSize * 2.5, sphereSize * 2.5, 1);
            group.add(sprite);
        } else {
            const material = new THREE.MeshLambertMaterial({ color: groupColor });
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(sphereSize, 16, 16),
                material
            );
            group.add(sphere);
        }

        // 2. Add Text Label above the node
        const sprite = new SpriteText(node.name);
        sprite.color = groupColor;
        sprite.textHeight = 4;
        sprite.position.y = sphereSize + 6; // Position above object
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
                linkColor={(link) => link.color || '#999'}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={1}

                // Interaction
                onNodeClick={handleNodeClick}

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

export default App;
