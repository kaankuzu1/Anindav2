"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
let CampaignsController = (() => {
    let _classDecorators = [(0, common_1.Controller)('campaigns'), (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'))];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _getCampaigns_decorators;
    let _getCampaign_decorators;
    let _createCampaign_decorators;
    let _updateCampaign_decorators;
    let _startCampaign_decorators;
    let _pauseCampaign_decorators;
    let _deleteCampaign_decorators;
    var CampaignsController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getCampaigns_decorators = [(0, common_1.Get)()];
            _getCampaign_decorators = [(0, common_1.Get)(':id')];
            _createCampaign_decorators = [(0, common_1.Post)()];
            _updateCampaign_decorators = [(0, common_1.Patch)(':id')];
            _startCampaign_decorators = [(0, common_1.Post)(':id/start')];
            _pauseCampaign_decorators = [(0, common_1.Post)(':id/pause')];
            _deleteCampaign_decorators = [(0, common_1.Delete)(':id')];
            __esDecorate(this, null, _getCampaigns_decorators, { kind: "method", name: "getCampaigns", static: false, private: false, access: { has: obj => "getCampaigns" in obj, get: obj => obj.getCampaigns }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getCampaign_decorators, { kind: "method", name: "getCampaign", static: false, private: false, access: { has: obj => "getCampaign" in obj, get: obj => obj.getCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createCampaign_decorators, { kind: "method", name: "createCampaign", static: false, private: false, access: { has: obj => "createCampaign" in obj, get: obj => obj.createCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _updateCampaign_decorators, { kind: "method", name: "updateCampaign", static: false, private: false, access: { has: obj => "updateCampaign" in obj, get: obj => obj.updateCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startCampaign_decorators, { kind: "method", name: "startCampaign", static: false, private: false, access: { has: obj => "startCampaign" in obj, get: obj => obj.startCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _pauseCampaign_decorators, { kind: "method", name: "pauseCampaign", static: false, private: false, access: { has: obj => "pauseCampaign" in obj, get: obj => obj.pauseCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteCampaign_decorators, { kind: "method", name: "deleteCampaign", static: false, private: false, access: { has: obj => "deleteCampaign" in obj, get: obj => obj.deleteCampaign }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            CampaignsController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        campaignsService = __runInitializers(this, _instanceExtraInitializers);
        constructor(campaignsService) {
            this.campaignsService = campaignsService;
        }
        async getCampaigns(teamId) {
            return this.campaignsService.getCampaigns(teamId);
        }
        async getCampaign(campaignId, teamId) {
            return this.campaignsService.getCampaign(campaignId, teamId);
        }
        async createCampaign(teamId, body) {
            return this.campaignsService.createCampaign(teamId, body);
        }
        async updateCampaign(campaignId, teamId, body) {
            return this.campaignsService.updateCampaign(campaignId, teamId, body);
        }
        async startCampaign(campaignId, teamId) {
            return this.campaignsService.startCampaign(campaignId, teamId);
        }
        async pauseCampaign(campaignId, teamId) {
            return this.campaignsService.pauseCampaign(campaignId, teamId);
        }
        async deleteCampaign(campaignId, teamId) {
            return this.campaignsService.deleteCampaign(campaignId, teamId);
        }
    };
    return CampaignsController = _classThis;
})();
exports.CampaignsController = CampaignsController;
//# sourceMappingURL=campaigns.controller.js.map