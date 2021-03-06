/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*/

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const $ = require('jquery');
  const AttachedClients = require('models/attached-clients');
  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const FormView = require('views/form');
  const preventDefaultThen = require('views/base').preventDefaultThen;
  const SettingsPanelMixin = require('views/mixins/settings-panel-mixin');
  const SignedOutNotificationMixin = require('views/mixins/signed-out-notification-mixin');
  const Strings = require('lib/strings');
  const t = require('views/base').t;
  const Template = require('stache!templates/settings/clients');
  const Url = require('lib/url');

  const DEVICE_REMOVED_ANIMATION_MS = 150;
  const UTM_PARAMS = '?utm_source=accounts.firefox.com&utm_medium=referral&utm_campaign=fxa-devices';
  const DEVICES_SUPPORT_URL = 'https://support.mozilla.org/kb/fxa-managing-devices' + UTM_PARAMS;
  const FIREFOX_ANDROID_DOWNLOAD_LINK = 'https://app.adjust.com/2uo1qc' +
    '?campaign=fxa-devices-page&adgroup=android&creative=button';
  const FIREFOX_IOS_DOWNLOAD_LINK = 'https://app.adjust.com/2uo1qc?' +
    'campaign=fxa-devices-page&adgroup=ios&creative=button' +
    '&fallback=https://itunes.apple.com/app/apple-store/id989804926?pt=373246&ct=adjust_tracker&mt=8';
  const FORCE_DEVICE_LIST_VIEW = 'forceDeviceList';
  const FORCE_APPS_LIST_VIEW = 'forceAppsList';

  var View = FormView.extend({
    template: Template,
    className: 'clients',
    viewName: 'settings.clients',

    initialize (options) {
      this._able = options.able;
      this._attachedClients = options.attachedClients;

      if (! this._attachedClients) {
        this._attachedClients = new AttachedClients([], {
          notifier: options.notifier
        });
      }

      this.listenTo(this._attachedClients, 'add', this._onItemAdded);
      this.listenTo(this._attachedClients, 'remove', this._onItemRemoved);
    },

    _formatAccessTime (items) {
      return _.map(items, function (item) {
        if (item.lastAccessTimeFormatted) {
          item.lastAccessTimeFormatted = Strings.interpolate(
            t('Last active %(translatedTimeAgo)s'), { translatedTimeAgo: item.lastAccessTimeFormatted });
        } else {
          // unknown lastAccessTimeFormatted or not possible to format.
          item.lastAccessTimeFormatted = '';
        }
        return item;
      });
    },

    context () {
      let clients = this._attachedClients.toJSON();

      return {
        clients: this._formatAccessTime(clients),
        clientsPanelTitle: this._getPanelTitle(),
        devicesSupportUrl: DEVICES_SUPPORT_URL,
        isPanelEnabled: this._isPanelEnabled(),
        isPanelOpen: this.isPanelOpen(),
        linkAndroid: FIREFOX_ANDROID_DOWNLOAD_LINK,
        linkIOS: FIREFOX_IOS_DOWNLOAD_LINK,
        showMobileApps: ! this._showMobileApps(clients)
      };
    },

    events: {
      'click .client-disconnect': preventDefaultThen('_onDisconnectClient'),
      'click .clients-refresh': preventDefaultThen('_onRefreshClientsList'),
      'click [data-get-app]': '_onGetApp'
    },

    _isPanelEnabled () {
      const account = this.user.getSignedInAccount();

      return this._able.choose('deviceListVisible', {
        forceDeviceList: Url.searchParam(FORCE_DEVICE_LIST_VIEW, this.window.location.search),
        uid: account.get('uid')
      });
    },

    /**
     * Returns true if we should show mobile app placeholders
     *
     * @param {Client[]} clients - array of attached clients
     * @returns {Boolean}
     * @private
     */
    _showMobileApps (clients) {
      if (! this.broker.hasCapability('convertExternalLinksToText')) {
        // if we cannot show links exit out early
        return false;
      }

      // we would show mobile apps if there are no mobile clients
      return ! _.some(clients, function (client) {
        return client.type === 'mobile';
      });
    },

    _getPanelTitle () {
      var title = t('Devices');

      if (this._isAppsListVisible()) {
        title = t('Devices & apps');
      }

      return title;
    },

    _isAppsListVisible () {
      // OAuth Apps list is visible if `appsListVisible` chooses `true`.
      return this._able.choose('appsListVisible', {
        forceAppsList: Url.searchParam(FORCE_APPS_LIST_VIEW, this.window.location.search),
        isMetricsEnabledValue: this.metrics.isCollectionEnabled()
      });
    },

    _onItemAdded () {
      this.render();
    },

    _onItemRemoved (item) {
      var id = item.get('id');
      $('#' + id).slideUp(DEVICE_REMOVED_ANIMATION_MS, () => {
        // re-render in case the last device is removed and the
        // "no registered devices" message needs to be shown.
        this.render();
      });
    },

    _onDisconnectClient (event) {
      var client = this._attachedClients.get($(event.currentTarget).data('id'));
      var clientType = client.get('clientType');
      this.logViewEvent(clientType + '.disconnect');
      // if a device then ask for confirmation
      if (clientType === Constants.CLIENT_TYPE_DEVICE) {
        this.navigate('settings/clients/disconnect', {
          clientId: client.get('id'),
          clients: this._attachedClients
        });
      } else {
        this.user.destroyAccountClient(this.user.getSignedInAccount(), client);
      }
    },

    _onRefreshClientsList () {
      if (this.isPanelOpen()) {
        this.logViewEvent('refresh');
        // only refresh devices if panel is visible
        // if panel is hidden there is no point of fetching devices
        this._fetchAttachedClients().then(() => {
          this.render();
        });
      }
    },

    _onGetApp (event) {
      var appType = this.$el.find(event.currentTarget).data('get-app');
      this.logViewEvent(`get.${appType}`);
    },

    openPanel () {
      this.logViewEvent('open');
      this._fetchAttachedClients();
    },

    _fetchAttachedClients () {
      return this._attachedClients.fetchClients({
        devices: true,
        oAuthApps: this._isAppsListVisible()
      }, this.user);
    }

  });

  Cocktail.mixin(
    View,
    SettingsPanelMixin,
    SignedOutNotificationMixin
  );

  module.exports = View;
});

