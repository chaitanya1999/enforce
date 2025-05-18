// import {circular} from 'https://cdn.jsdelivr.net/npm/graphology-layout@0.6.1/index.min.js?module';
import {circular} from 'graphology-layout';

const Graph = window.graphology;
const sigma = window.sigma;
// Create a graphology graph
const graph = new graphology.Graph();


let i = 0;
let nodes = new Set();
for(let node of Object.keys(apexTree)) {
    if(!nodes.has(node)) {
        graph.addNode(node, { label: node, size: 10 });
        nodes.add(node);
    }
    for(let outlink of apexTree[node].outlinks) {
        if(!nodes.has(outlink)) {
            graph.addNode(outlink, { label: outlink, size: 10 });
            nodes.add(outlink);
        }
        graph.addEdgeWithKey(`${node}_${outlink}`, node, outlink, { size: 5, color: "purple" });
    }
    /*for(let inlink of apexTree[node].inlinks) {
        if(!nodes.has(inlink)) {
            graph.addNode(inlink, { label: inlink, size: 10 });
            nodes.add(inlink);
        }
        graph.addEdgeWithKey(`${inlink}_${node}`, inlink, node, { size: 5, color: "purple" });
    }*/
}
//circular.assign(graph);
graphologyLayoutCircular.assign(graph);



// Instantiate sigma.js and render the graph
const sigmaInstance = new Sigma(graph, document.getElementById("container"), {
    renderEdgeLabels: true,
    defaultEdgeType: 'arrow'
});