import React, { useState, useMemo, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';

// Group colors configuration
const GROUP_COLORS = {
    govt: '#FF9933',
    opposition: '#00FF00',
    business: '#00BFFF',
    party: '#FFF',
    bureaucrat: '#9C27B0',
    ally: '#FFC107',
    ideology: '#795548',
    sports: '#E91E63',
    default: '#ccc'
};

const CrimeBoardView = ({ data, loading, legend }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [focusNode, setFocusNode] = useState(null);
    const [filteredData, setFilteredData] = useState({ nodes: [], links: [] });
    // Trigger re-render for images
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const fgRef = useRef();

    // 0. Preload Images with State Trigger
    useEffect(() => {
        if (data && data.nodes) {
            data.nodes.forEach(node => {
                if (node.img && !node.imgObj) {
                    const img = new Image();
                    img.src = node.img;
                    img.onload = () => {
                        // Mark complete and trigger re-render
                        node.imgLoaded = true;
                        setImagesLoaded(prev => prev + 1);
                    };
                    node.imgObj = img; // Attach to node for canvas to use
                }
            });
        }
    }, [data]);

    // -- LOGIC: Filter Graph based on Search/Focus --
    useEffect(() => {
        if (!focusNode) {
            setFilteredData(data || { nodes: [], links: [] });
            return;
        }

        // 1. Get Focus Node ID
        const centerId = focusNode.id;

        // 2. Find direct neighbors (1st degree)
        const neighborIds = new Set();
        const connectedLinks = [];

        // Safe check for links
        if (data && data.links) {
            data.links.forEach(link => {
                // Handle both object and string ID cases just to be safe
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;

                if (sId === centerId) {
                    neighborIds.add(tId);
                    connectedLinks.push(link);
                } else if (tId === centerId) {
                    neighborIds.add(sId);
                    connectedLinks.push(link);
                }
            });
        }

        neighborIds.add(centerId); // Add self

        const filteredNodes = data.nodes.filter(node => neighborIds.has(node.id));
        
        setFilteredData({ nodes: filteredNodes, links: connectedLinks });

        // Zoom to fit finding & Reheat
        if (fgRef.current) {
            fgRef.current.d3ReheatSimulation();
            setTimeout(() => {
                 fgRef.current.zoomToFit(1000, 50);
            }, 500);
        }
    }, [focusNode, data]);

    // Handle Search
    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        
        if (!term) {
            setFocusNode(null);
            return;
        }

        // Find match
        const match = data.nodes.find(n => 
            n.name.toLowerCase().includes(term.toLowerCase())
        );

        if (match) {
            setFocusNode(match);
        } else {
            // Optional: setFocusNode(null) if strict, or keep previous. 
            // Better to clear if not found to avoid confusion.
            setFocusNode(null);
        }
    };

    // Custom Node Rendering (Polaroid Pin Style)
    const nodeCanvasObject = (node, ctx,globalScale) => {
        const size = 12; // Base size
        const label = node.name;
        const fontSize = 12/globalScale;
        
        // 1. Draw "Polaroid" white bg
        ctx.fillStyle = '#f0f0f0';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        
        const w = 30;
        const h = 35;
        const x = node.x - w/2;
        const y = node.y - h/2;

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        // Reset shadow
        ctx.shadowColor = 'transparent';

        // 2. Draw Image from preloaded Obj
        // Use imgLoaded flag or complete check
        if (node.imgObj && (node.imgLoaded || node.imgObj.complete)) {
             // Crop to square? or fit?
             try {
                ctx.drawImage(node.imgObj, x + 2, y + 2, w - 4, w - 4);
             } catch(e) {
                // Fallback
                ctx.fillStyle = GROUP_COLORS[node.group_type] || '#999';
                ctx.fillRect(x + 2, y + 2, w - 4, w - 4);
             }
        } else {
            ctx.fillStyle = GROUP_COLORS[node.group_type] || '#999';
            ctx.fillRect(x + 2, y + 2, w - 4, w - 4);
        }

        // 3. "Pin" at top center
        ctx.beginPath();
        ctx.arc(node.x, y + 2, 2, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.strokeStyle = '#darkred';
        ctx.stroke();

        // 4. Name Label (Handwritten style look?)
        ctx.font = `${fontSize}px Sans-Serif`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(label, node.x, y + h - 5);
    };

    // Adjust D3 Forces after graph initialization
    useEffect(() => {
        if (fgRef.current) {
            const fg = fgRef.current;
            
            // 1. Increase Link Distance (Spread out connected nodes)
            // Was 120, user wants "increase a little bit" -> 200
            fg.d3Force('link').distance(200);
            
            // 2. Repulsion (Avoid clutter)
            fg.d3Force('charge').strength(-300);

            // 3. Center Gravity (Bring disconnected sets closer)
            // Using forceRadial to gently pull everything to (0,0)
            // This prevents islands from flying off to infinity
            fg.d3Force('radial', d3.forceRadial(0, 0, 0).strength(0.08));
            
            // Remove hard centering if we use radial? 
            // 'center' keeps the centroid at (0,0). 
            // 'radial' pulls nodes to (0,0).
            // They work together fine.
            fg.d3Force('center').strength(0.1); 
            
            // Re-heat simulation to apply forces
            fg.d3ReheatSimulation();
        }
    }, [filteredData]); 

    if (loading) return <div style={{ color: 'white', padding: 20 }}>Loading Evidence Board...</div>;

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            position: 'relative', 
            backgroundColor: '#222', 
            backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', // Dot grid
            backgroundSize: '20px 20px'
        }}>
            
            {/* Search Overlay */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '400px'
            }}>
                <div style={{
                    background: '#f4e9d8', // Manilla folder color
                    padding: '5px 15px',
                    borderRadius: '5px 5px 0 0',
                    fontWeight: 'bold',
                    color: '#5d4037',
                    border: '1px solid #8d6e63',
                    borderBottom: 'none',
                    fontSize: '12px',
                    letterSpacing: '1px'
                }}>
                    CONFIDENTIAL CASE FILE
                </div>
                <input 
                    type="text"
                    placeholder="Search Suspect / Leader..."
                    value={searchTerm}
                    onChange={handleSearch}
                    style={{
                        width: '100%',
                        padding: '15px 20px',
                        fontSize: '18px',
                        border: '2px solid #5d4037',
                        borderRadius: '4px',
                        backgroundColor: '#fffcf5', // Paper color
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                    }}
                />
                {focusNode && (
                     <div style={{ 
                        marginTop: '10px', 
                        color: '#f0f0f0', 
                        background: 'rgba(0,0,0,0.6)', 
                        padding: '5px 10px', 
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}>
                        Central Focus: {focusNode.name}
                     </div>
                )}
            </div>

            <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                nodeCanvasObject={nodeCanvasObject}
                nodeLabel="name"
                
                // Link Styling (Thread)
                linkColor={link => link.color || '#999'}
                linkWidth={2}
                linkLineDash={[5, 2]} // Dashed "string" look? Or solid. Let's try solid first but rough? 
                // Solid is better for string.
                
                // Forces
                d3AlphaDecay={0.02} // Slower decay for more settling time
                d3VelocityDecay={0.3} // Higher friction for "pinned" feel
                cooldownTicks={100}
                
                // Background
                backgroundColor="transparent"
                className="crime-board-canvas"
                onEngineStop={() => {
                    // Only zoom to fit if we have a focus, or maybe just once initially
                    if (focusNode) fgRef.current.zoomToFit(400);
                }}
            />

            {/* Hint */}
            {!focusNode && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    opacity: 0.5
                }}>
                    <h2 style={{ color: '#fff', fontFamily: 'monospace' }}>CASE #2024-IN</h2>
                    <p style={{ color: '#ccc' }}>Use the search bar to pin a target.</p>
                </div>
            )}
        </div>
    );
};

export default CrimeBoardView;
