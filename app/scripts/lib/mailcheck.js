/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A ux utility to suggest correct spelling of email domains

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const KeyCodes = require('lib/key-codes');
  const mailcheck = require('mailcheck'); //eslint-disable-line no-unused-vars
  const Tooltip = require('views/tooltip');
  const t = (msg) => msg;

  const DOMAINS = [];
  const SECOND_LEVEL_DOMAINS = [ // domains that get suggested, i.e gnail => gmail
    'gmail', 'qq', 'yandex', 'o2', 'rambler', 'googlemail', 't-online', 'mail', 'web',
    'sbcglobal', 'msn', 'hotmail', 'me', 'aol', 'seznam', 'comcast', 'orange',
    'gmx', 'ymail', 'outlook', 'live', 'yahoo'
  ];
  const TOP_LEVEL_DOMAINS = [];
  const MIN_CHARS = 5; // start suggesting email correction after MIN_CHARS
  const SUGGEST_DIV_CLASS = 'tooltip-suggest';

  const DID_YOU_MEAN_TEXT = t('Did you mean <span tabindex="1">%(escapedDomain)s</span>?');


  /**
   * @param {Object} target DOM input node to target with mailcheck
   * @param {Object} view View mailcheck is used with
   */
  module.exports = function checkMailInput(target, view) {
    var element = $(target);
    if (! element.length || ! view) {
      return;
    }

    // check if the text value was changed before showing the tooltip
    if (element.data('previousValue') !== element.val() && element.val().length > MIN_CHARS) {
      view.notifier.trigger('mailcheck.triggered');

      element.mailcheck({
        domains: DOMAINS,
        secondLevelDomains: SECOND_LEVEL_DOMAINS,
        topLevelDomains: TOP_LEVEL_DOMAINS,
        suggested (element, suggestion) {
          // avoid suggesting empty or incomplete domains
          var incompleteDomain = ! suggestion || ! suggestion.domain ||
            suggestion.domain.indexOf('.') === -1;

          if (incompleteDomain) {
            return;
          }

          // user got a suggestion to check their email input
          view.notifier.trigger('mailcheck.suggested');
          if (view.isInExperimentGroup('mailcheck', 'treatment')) {

            const message = view.unsafeTranslate(DID_YOU_MEAN_TEXT, {
              escapedDomain: _.escape(suggestion.domain)
            });

            let tooltip = new Tooltip({
              dismissible: true,
              extraClassNames: SUGGEST_DIV_CLASS,
              invalidEl: target,
              type: 'mailcheck',
              unsafeMessage: message
            });

            tooltip.render();
            // set that this value was suggested, user might not click on the tooltip
            // but still take the suggestion
            element.data('mailcheckValue', suggestion.full);

            tooltip.$el.on('click keypress', 'span', function (e) {
              // if a click event is triggered or an enter key is pressed, destroy
              // the tooltip.
              if (e.type === 'click' || e.which === KeyCodes.ENTER) {
                element.val(suggestion.full);
                // the user has used the suggestion
                view.notifier.trigger('mailcheck.clicked');
                tooltip._destroy();
                tooltip = null;
              }
            });
          }
        }
      });
    }
    element.data('previousValue', element.val());
  };
});
