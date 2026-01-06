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
exports.InboxesController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
let InboxesController = (() => {
    let _classDecorators = [(0, common_1.Controller)('inboxes'), (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'))];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _getInboxes_decorators;
    let _getInbox_decorators;
    let _updateInboxSettings_decorators;
    let _pauseInbox_decorators;
    let _resumeInbox_decorators;
    let _deleteInbox_decorators;
    var InboxesController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getInboxes_decorators = [(0, common_1.Get)()];
            _getInbox_decorators = [(0, common_1.Get)(':id')];
            _updateInboxSettings_decorators = [(0, common_1.Patch)(':id')];
            _pauseInbox_decorators = [(0, common_1.Post)(':id/pause')];
            _resumeInbox_decorators = [(0, common_1.Post)(':id/resume')];
            _deleteInbox_decorators = [(0, common_1.Delete)(':id')];
            __esDecorate(this, null, _getInboxes_decorators, { kind: "method", name: "getInboxes", static: false, private: false, access: { has: obj => "getInboxes" in obj, get: obj => obj.getInboxes }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getInbox_decorators, { kind: "method", name: "getInbox", static: false, private: false, access: { has: obj => "getInbox" in obj, get: obj => obj.getInbox }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _updateInboxSettings_decorators, { kind: "method", name: "updateInboxSettings", static: false, private: false, access: { has: obj => "updateInboxSettings" in obj, get: obj => obj.updateInboxSettings }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _pauseInbox_decorators, { kind: "method", name: "pauseInbox", static: false, private: false, access: { has: obj => "pauseInbox" in obj, get: obj => obj.pauseInbox }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resumeInbox_decorators, { kind: "method", name: "resumeInbox", static: false, private: false, access: { has: obj => "resumeInbox" in obj, get: obj => obj.resumeInbox }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteInbox_decorators, { kind: "method", name: "deleteInbox", static: false, private: false, access: { has: obj => "deleteInbox" in obj, get: obj => obj.deleteInbox }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            InboxesController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        inboxesService = __runInitializers(this, _instanceExtraInitializers);
        constructor(inboxesService) {
            this.inboxesService = inboxesService;
        }
        async getInboxes(req, teamId) {
            return this.inboxesService.getInboxes(teamId);
        }
        async getInbox(inboxId, teamId) {
            return this.inboxesService.getInbox(inboxId, teamId);
        }
        async updateInboxSettings(inboxId, teamId, body) {
            return this.inboxesService.updateInboxSettings(inboxId, teamId, body);
        }
        async pauseInbox(inboxId, teamId) {
            return this.inboxesService.pauseInbox(inboxId, teamId);
        }
        async resumeInbox(inboxId, teamId) {
            return this.inboxesService.resumeInbox(inboxId, teamId);
        }
        async deleteInbox(inboxId, teamId) {
            return this.inboxesService.deleteInbox(inboxId, teamId);
        }
    };
    return InboxesController = _classThis;
})();
exports.InboxesController = InboxesController;
//# sourceMappingURL=inboxes.controller.js.map