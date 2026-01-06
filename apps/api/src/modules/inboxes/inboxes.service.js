"use strict";
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxesService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@aninda/shared");
let InboxesService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var InboxesService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            InboxesService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        supabase;
        configService;
        encryptionKey;
        constructor(supabase, configService) {
            this.supabase = supabase;
            this.configService = configService;
            this.encryptionKey = this.configService.getOrThrow('ENCRYPTION_KEY');
        }
        async getInboxes(teamId) {
            const { data, error } = await this.supabase
                .from('inboxes')
                .select('*, inbox_settings(*), warmup_state(*)')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            return data;
        }
        async getInbox(inboxId, teamId) {
            const { data, error } = await this.supabase
                .from('inboxes')
                .select('*, inbox_settings(*), warmup_state(*)')
                .eq('id', inboxId)
                .eq('team_id', teamId)
                .single();
            if (error || !data) {
                throw new common_1.NotFoundException('Inbox not found');
            }
            return data;
        }
        async createOAuthInbox(teamId, email, provider, accessToken, refreshToken, expiresAt) {
            // Encrypt tokens
            const encryptedAccessToken = (0, shared_1.encrypt)(accessToken, this.encryptionKey);
            const encryptedRefreshToken = (0, shared_1.encrypt)(refreshToken, this.encryptionKey);
            const { data: inbox, error } = await this.supabase
                .from('inboxes')
                .insert({
                team_id: teamId,
                email,
                provider,
                status: 'active',
                oauth_access_token: encryptedAccessToken,
                oauth_refresh_token: encryptedRefreshToken,
                oauth_expires_at: expiresAt?.toISOString(),
            })
                .select()
                .single();
            if (error)
                throw error;
            // Create default settings
            await this.supabase
                .from('inbox_settings')
                .insert({
                inbox_id: inbox.id,
            });
            // Create warmup state
            await this.supabase
                .from('warmup_state')
                .insert({
                inbox_id: inbox.id,
                enabled: false,
            });
            return inbox;
        }
        async updateInboxSettings(inboxId, teamId, settings) {
            // Verify inbox belongs to team
            await this.getInbox(inboxId, teamId);
            const { data, error } = await this.supabase
                .from('inbox_settings')
                .update(settings)
                .eq('inbox_id', inboxId)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        async pauseInbox(inboxId, teamId) {
            await this.getInbox(inboxId, teamId);
            const { data, error } = await this.supabase
                .from('inboxes')
                .update({
                status: 'paused',
                paused_at: new Date().toISOString(),
            })
                .eq('id', inboxId)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        async resumeInbox(inboxId, teamId) {
            await this.getInbox(inboxId, teamId);
            const { data, error } = await this.supabase
                .from('inboxes')
                .update({
                status: 'active',
                paused_at: null,
            })
                .eq('id', inboxId)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        async deleteInbox(inboxId, teamId) {
            await this.getInbox(inboxId, teamId);
            const { error } = await this.supabase
                .from('inboxes')
                .delete()
                .eq('id', inboxId);
            if (error)
                throw error;
            return { success: true };
        }
        async getDecryptedCredentials(inboxId, teamId) {
            const inbox = await this.getInbox(inboxId, teamId);
            if (!inbox.oauth_access_token || !inbox.oauth_refresh_token) {
                return null;
            }
            return {
                accessToken: (0, shared_1.decrypt)(inbox.oauth_access_token, this.encryptionKey),
                refreshToken: (0, shared_1.decrypt)(inbox.oauth_refresh_token, this.encryptionKey),
                expiresAt: inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at) : undefined,
            };
        }
        async updateCredentials(inboxId, accessToken, refreshToken, expiresAt) {
            const encryptedAccessToken = (0, shared_1.encrypt)(accessToken, this.encryptionKey);
            const encryptedRefreshToken = (0, shared_1.encrypt)(refreshToken, this.encryptionKey);
            const { error } = await this.supabase
                .from('inboxes')
                .update({
                oauth_access_token: encryptedAccessToken,
                oauth_refresh_token: encryptedRefreshToken,
                oauth_expires_at: expiresAt?.toISOString(),
            })
                .eq('id', inboxId);
            if (error)
                throw error;
        }
        async incrementSentCount(inboxId) {
            // Use raw SQL for atomic increment
            const { error } = await this.supabase.rpc('increment_inbox_sent', {
                inbox_id: inboxId,
            });
            if (error) {
                // Fallback to regular update
                const { data: inbox } = await this.supabase
                    .from('inboxes')
                    .select('sent_today, sent_total')
                    .eq('id', inboxId)
                    .single();
                if (inbox) {
                    await this.supabase
                        .from('inboxes')
                        .update({
                        sent_today: (inbox.sent_today ?? 0) + 1,
                        sent_total: (inbox.sent_total ?? 0) + 1,
                        last_sent_at: new Date().toISOString(),
                    })
                        .eq('id', inboxId);
                }
            }
        }
    };
    return InboxesService = _classThis;
})();
exports.InboxesService = InboxesService;
//# sourceMappingURL=inboxes.service.js.map