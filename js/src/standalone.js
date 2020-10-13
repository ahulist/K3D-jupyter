require('style-loader?{attrs:{id: "k3d-katex"}}!css-loader!../node_modules/katex/dist/katex.min.css');
require('style-loader?{attrs:{id: "k3d-dat.gui"}}!css-loader!../node_modules/dat.gui/build/dat.gui.css');

module.exports = {
    K3D: require('./core/Core'),
    ThreeJsProvider: require('./providers/threejs/provider'),
    version: require('./version').version
};
