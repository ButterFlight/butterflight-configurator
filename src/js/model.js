'use strict';

// generate mixer
var mixerList = [
    {name: 'Quad X',           pos: 0,  model: 'quad_x',     image: 'quad_x'},
    {name: 'Quad X 1234',      pos: 1,  model: 'quad_x',     image: 'quad_x_1234'}
    {name: 'Custom',           pos: 2,  model: 'custom',     image: 'custom'},
];

// 3D model
var Model = function (wrapper, canvas) {
    var useWebGLRenderer = this.canUseWebGLRenderer();

    this.wrapper = wrapper;
    this.canvas = canvas;

    if (useWebGLRenderer) {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas[0], alpha: true, antialias: true });
    } else {
        this.renderer = new THREE.CanvasRenderer({ canvas: this.canvas[0], alpha: true });
    }

    // initialize render size for current canvas size
    this.renderer.setSize(this.wrapper.width() * 2, this.wrapper.height() * 2);

    // load the model including materials
    var model_file = useWebGLRenderer ? mixerList[MIXER_CONFIG.mixer - 1].model : 'fallback';

    // Temporary workaround for 'custom' model until akfreak's custom model is merged.
    if (model_file == 'custom') { model_file = 'fallback'; }

    // setup scene
    this.scene = new THREE.Scene();

    // modelWrapper adds an extra axis of rotation to avoid gimbal lock with the euler angles
    this.modelWrapper = new THREE.Object3D();

    // stationary camera
    this.camera = new THREE.PerspectiveCamera(60, this.wrapper.width() / this.wrapper.height(), 1, 10000);

    // move camera away from the model
    this.camera.position.z = 125;

    // some light
    var light = new THREE.AmbientLight(0x404040);
    var light2 = new THREE.DirectionalLight(new THREE.Color(1, 1, 1), 1.5);
    light2.position.set(0, 1, 0);

    // add camera, model, light to the foreground scene
    this.scene.add(light);
    this.scene.add(light2);
    this.scene.add(this.camera);
    this.scene.add(this.modelWrapper);

    // Load model file, add to scene and render it
    this.loadJSON(model_file, (function (model) {
        this.model = model;

        this.modelWrapper.add(model);
        this.scene.add(this.modelWrapper);

        this.render();
    }).bind(this));
};

Model.prototype.loadJSON = function (model_file, callback) {
    var loader = new THREE.JSONLoader();

    loader.load('./resources/models/' + model_file + '.json', function (geometry, materials) {
        var modelMaterial = new THREE.MeshFaceMaterial(materials),
            model         = new THREE.Mesh(geometry, modelMaterial);

        model.scale.set(15, 15, 15);

        callback(model);
    });
};

Model.prototype.canUseWebGLRenderer = function () {
    // webgl capability detector
    // it would seem the webgl "enabling" through advanced settings will be ignored in the future
    // and webgl will be supported if gpu supports it by default (canary 40.0.2175.0), keep an eye on this one
    var detector_canvas = document.createElement('canvas');

    return window.WebGLRenderingContext && (detector_canvas.getContext('webgl') || detector_canvas.getContext('experimental-webgl'));
};

Model.prototype.rotateTo = function (x, y, z) {
    if (!this.model) { return; }

    this.model.rotation.x = x;
    this.modelWrapper.rotation.y = y;
    this.model.rotation.z = z;

    this.render();
};

Model.prototype.rotateBy = function (x, y, z) {
    if (!this.model) { return; }

    this.model.rotateX(x);
    this.model.rotateY(y);
    this.model.rotateZ(z);

    this.render();
};

Model.prototype.render = function () {
    if (!this.model) { return; }

    // draw
    this.renderer.render(this.scene, this.camera);
};

// handle canvas resize
Model.prototype.resize = function () {
    this.renderer.setSize(this.wrapper.width() * 2, this.wrapper.height() * 2);

    this.camera.aspect = this.wrapper.width() / this.wrapper.height();
    this.camera.updateProjectionMatrix();

    this.render();
};
