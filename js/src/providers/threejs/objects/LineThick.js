'use strict';

var THREE = require('three'),
    colorsToFloat32Array = require('./../../../core/lib/helpers/buffer').colorsToFloat32Array,
    MeshLine = require('./../helpers/THREE.MeshLine')(THREE),
    Fn = require('./../helpers/Fn'),
    commonUpdate = Fn.commonUpdate,
    areAllChangesResolve = Fn.areAllChangesResolve,
    colorMapHelper = require('./../../../core/lib/helpers/colorMap'),
    getColorsArray = Fn.getColorsArray;

/**
 * Loader strategy to handle Line object
 * @method Line
 * @memberof K3D.Providers.ThreeJS.Objects
 * @param {Object} config all configurations params from JSON
 * @return {Object} 3D object ready to render
 */
function create(config, K3D) {
    config.width = typeof (config.width) !== 'undefined' ? config.width : 0.1;

    var material = new MeshLine.MeshLineMaterial({
            color: new THREE.Color(1, 1, 1),
            opacity: 1.0,
            sizeAttenuation: true,
            transparent: true,
            lineWidth: config.width,
            resolution: new THREE.Vector2(K3D.getWorld().width, K3D.getWorld().height),
            side: THREE.DoubleSide
        }),
        verticesColors = (config.colors && config.colors.data) || null,
        color = new THREE.Color(config.color),
        colors = null,
        uvs = null,
        colorRange = config.color_range,
        colorMap = (config.color_map && config.color_map.data) || null,
        attribute = (config.attribute && config.attribute.data) || null,
        object,
        resizelistenerId,
        modelMatrix = new THREE.Matrix4(),
        position = config.vertices.data;

    if (attribute && colorRange && colorMap && attribute.length > 0 && colorRange.length > 0 && colorMap.length > 0) {
        var canvas = colorMapHelper.createCanvasGradient(colorMap, 1024);
        var texture = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
        texture.needsUpdate = true;

        material.uniforms.useMap.value = 1.0;
        material.uniforms.map.value = texture;

        uvs = new Float32Array(attribute.length);

        for (var i = 0; i < attribute.length; i++) {
            uvs[i] = (attribute[i] - colorRange[0]) / (colorRange[1] - colorRange[0]);
        }
    } else {
        colors = (verticesColors && verticesColors.length === position.length / 3 ?
                colorsToFloat32Array(verticesColors) : getColorsArray(color, position.length / 3)
        );
    }

    var line = new MeshLine.MeshLine();

    line.setGeometry(new Float32Array(position), false, null, colors, uvs);
    line.geometry.computeBoundingSphere();
    line.geometry.computeBoundingBox();

    object = new THREE.Mesh(line.geometry, material);
    object.userData.meshLine = line;
    object.userData.lastPosition = new Float32Array(position);
    object.userData.lastUVs = uvs;
    object.userData.lastColors = colors;

    modelMatrix.set.apply(modelMatrix, config.model_matrix.data);
    object.applyMatrix(modelMatrix);

    object.updateMatrixWorld();

    resizelistenerId = K3D.on(K3D.events.RESIZED, function () {
        // update outlines
        object.material.uniforms.resolution.value.x = K3D.getWorld().width;
        object.material.uniforms.resolution.value.y = K3D.getWorld().height;
    });

    object.onRemove = function () {
        K3D.off(K3D.events.RESIZED, resizelistenerId);
        if (object.material.uniforms.map.value) {
            object.material.uniforms.map.value.dispose();
            object.material.uniforms.map.value = undefined;
        }
    };

    return Promise.resolve(object);
}


function update(config, changes, obj) {
    var uvs = obj.userData.lastUVs,
        position = obj.userData.lastPosition,
        colors = obj.userData.lastColors,
        resolvedChanges = {};

    if (typeof (obj.geometry.attributes.uv) !== 'undefined') {
        if (typeof(changes.color_range) !== 'undefined' && !changes.color_range.timeSeries) {
            obj.material.uniforms.low.value = changes.color_range[0];
            obj.material.uniforms.high.value = changes.color_range[1];

            resolvedChanges.color_range = null;
        }

        if (typeof(changes.attribute) !== 'undefined' && !changes.attribute.timeSeries) {
            if (changes.attribute.data.length !== obj.geometry.attributes.uv.array.length) {
                return false;
            }

            uvs = new Float32Array(changes.attribute.data.length);

            for (var i = 0; i < uvs.length; i++) {
                uvs[i] = (changes.attribute.data[i] - config.color_range[0]) /
                         (config.color_range[1] - config.color_range[0]);
            }

            obj.userData.lastUVs = uvs;
        }
    }

    if (typeof(changes.vertices) !== 'undefined' && !changes.vertices.timeSeries) {
        if (changes.vertices.data.length !== position.length) {
            return false;
        }

        position = changes.vertices.data;
        obj.userData.lastPosition = position;
    }

    if (typeof(changes.attribute) !== 'undefined' || typeof(changes.vertices) !== 'undefined') {
        obj.userData.meshLine.setGeometry(position, false, null, colors, uvs);

        resolvedChanges.attribute = null;
        resolvedChanges.vertices = null;
    }

    commonUpdate(config, changes, resolvedChanges, obj);

    if (areAllChangesResolve(changes, resolvedChanges)) {
        return Promise.resolve({json: config, obj: obj});
    } else {
        return false;
    }
}

module.exports = {
    create: create,
    update: update
};
