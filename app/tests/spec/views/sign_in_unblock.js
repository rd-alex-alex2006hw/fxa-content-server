/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const assert = require('chai').assert;
  const Account = require('models/account');
  const AuthErrors = require('lib/auth-errors');
  const Backbone = require('backbone');
  const BaseBroker = require('models/auth_brokers/base');
  const Constants = require('lib/constants');
  const { createRandomHexString } = require('../../lib/helpers');
  const Metrics = require('lib/metrics');
  const p = require('lib/promise');
  const Relier = require('models/reliers/relier');
  const sinon = require('sinon');
  const View = require('views/sign_in_unblock');
  const WindowMock = require('../../mocks/window');

  // trailing " is intentional to ensure rendered link is properly escaped
  const UNSAFE_SUMO_LINK = 'https://support.mozilla.org/why-am-i-blocked"';
  const UNBLOCK_CODE = createRandomHexString(Constants.UNBLOCK_CODE_LENGTH);

  describe('views/sign_in_unblock', () => {
    let able;
    let account;
    let broker;
    let metrics;
    let model;
    let relier;
    let view;
    let windowMock;

    beforeEach(() => {
      able = {
        choose () { }
      };
      metrics = new Metrics();
      windowMock = new WindowMock();

      relier = new Relier({
        window: windowMock
      });

      broker = new BaseBroker({
        relier: relier,
        window: windowMock
      });

      account = new Account({
        email: 'a@a.com',
        uid: 'uid'
      });

      model = new Backbone.Model({
        account: account,
        lastPage: 'signin',
        password: 'password'
      });

      view = new View({
        able,
        broker,
        canGoBack: true,
        metrics,
        model,
        relier,
        viewName: 'sign-in-unblock',
        window: windowMock
      });

      return view.render();
    });

    afterEach(function () {
      metrics.destroy();

      view.remove();
      view.destroy();

      view = metrics = null;
    });

    describe('render', () => {
      it('renders the view', () => {
        assert.lengthOf(view.$('#fxa-signin-unblock-header'), 1);
        assert.include(view.$('.verification-email-message').text(), 'a@a.com');
      });

      describe('without an account', () => {
        beforeEach(() => {
          model.unset('account');
          sinon.stub(view, 'navigate', () => {});

          return view.render();
        });

        it('redirects to the signin page', () => {
          assert.isTrue(view.navigate.calledWith('signin'));
        });
      });

      describe('without a support link', () => {
        beforeEach(() => {
          return view.render();
        });

        it('does not render the support link', () => {
          assert.lengthOf(view.$('#support-link'), 0);
        });
      });

      describe('with a support link', () => {
        beforeEach(() => {
          sinon.stub(able, 'choose', (experimentName) => {
            if (experimentName === 'blockedSigninSupportUrl') {
              return UNSAFE_SUMO_LINK;
            }
          });

          return view.render();
        });

        it('renders the support link using a safe URL', () => {
          const $supportLinkEl = view.$('#support-link');
          assert.lengthOf($supportLinkEl, 1);
          assert.equal($supportLinkEl.attr('href'), encodeURI(UNSAFE_SUMO_LINK));
        });
      });
    });

    describe('resend', () => {
      describe('success', () => {
        beforeEach(() => {
          sinon.stub(account, 'sendUnblockEmail', () => p());
          return view.resend();
        });

        it('delegate to the account', () => {
          assert.isTrue(account.sendUnblockEmail.called);
        });
      });

      describe('errors', () => {
        let err = AuthErrors.toError('UNEXPECTED_ERROR');

        beforeEach(() => {
          sinon.stub(account, 'sendUnblockEmail', () => p.reject(err));
          sinon.spy(view, 'displayError');

          return view.resend();
        });

        it('displays the error', () => {
          assert.isTrue(view.displayError.calledWith(err));
        });
      });
    });

    describe('validateAndSubmit', () => {
      beforeEach(() => {
        sinon.stub(view, 'submit', () => p());
        sinon.spy(view, 'showValidationError');
      });

      describe('with an empty code', () => {
        beforeEach(() => {
          view.$('#unblock_code').val('');
          return view.validateAndSubmit();
        });

        it('displays a tooltip, does not call submit', () => {
          assert.isTrue(view.showValidationError.called);
          assert.isFalse(view.submit.called);
        });
      });

      describe('with an invalid code', () => {
        beforeEach(() => {
          view.$('#unblock_code').val('1');
          return view.validateAndSubmit();
        });

        it('displays a tooltip, does not call submit', () => {
          assert.isTrue(view.showValidationError.called);
          assert.isFalse(view.submit.called);
        });
      });

      const validUnblockCodes = [
        UNBLOCK_CODE,
        '   ' + UNBLOCK_CODE,
        UNBLOCK_CODE + '   ',
        '   ' + UNBLOCK_CODE + '   '
      ];
      validUnblockCodes.forEach((unblockCode) => {
        describe(`with a valid code: '${unblockCode}'`, () => {
          beforeEach(() => {
            view.$('#unblock_code').val(UNBLOCK_CODE);
            view.enableSubmitIfValid();
            return view.validateAndSubmit();
          });

          it('calls submit', () => {
            assert.equal(view.submit.callCount, 1);
          });
        });
      });
    });

    describe('submit', () => {
      describe('success', () => {
        beforeEach(() => {
          sinon.stub(view, 'signIn', () => p());

          view.$('#unblock_code').val(UNBLOCK_CODE);

          return view.submit();
        });

        it('delegates to view.signIn, with the `password` and `unblockCode`', () => {
          assert.isTrue(view.signIn.calledWith(
            account, 'password', { unblockCode: UNBLOCK_CODE }));
        });
      });

      describe('incorrect password', () => {
        const incorrectPasswordError =
          AuthErrors.toError('INCORRECT_PASSWORD');

        beforeEach(() => {
          sinon.stub(view, 'signIn',
             () => p.reject(incorrectPasswordError));

          sinon.stub(view, 'navigate', () => p());

          view.$('#unblock_code').val(UNBLOCK_CODE);

          return view.submit();
        });

        it('redirects to `signin` with the account `email` and error', () => {
          assert.isTrue(view.navigate.calledWith('signin', {
            email: account.get('email'),
            error: incorrectPasswordError
          }));
        });
      });

      describe('other errors', () => {
        const unexpectedError = AuthErrors.toError('UNEXPECTED_ERROR');
        let receivedError;

        beforeEach(() => {
          sinon.stub(view, 'signIn',
             () => p.reject(unexpectedError));

          sinon.stub(view, 'navigate', () => p());

          view.$('#unblock_code').val(UNBLOCK_CODE);

          return view.submit()
            .then(assert.fail, (err) => receivedError = err);
        });

        it('rejects with the error for display at a lower level', () => {
          assert.isTrue(AuthErrors.is(receivedError, 'UNEXPECTED_ERROR'));
        });
      });
    });

    describe('_getAuthPage', () => {
      describe('default', () => {
        it('returns `signin`', () => {
          assert.equal(view._getAuthPage(), 'signin');
        });
      });

      describe('user came from `force_auth`', () => {
        beforeEach(() => {
          model.set('lastPage', 'force_auth');
        });

        it('returns `force_auth`', () => {
          assert.equal(view._getAuthPage(), 'force_auth');
        });
      });

      describe('broker modifies URL', () => {
        beforeEach(() => {
          sinon.stub(broker, 'transformLink', (url) => `/oauth/${url}`);
        });

        it('returns URL the broker returns', () => {
          assert.equal(view._getAuthPage(), '/oauth/signin');
        });
      });
    });

    describe('_getSupportLink', () => {
      beforeEach(() => {
        sinon.stub(able, 'choose', (experimentName) => {
          if (experimentName === 'blockedSigninSupportUrl') {
            return UNSAFE_SUMO_LINK;
          }
        });
      });

      it('returns the value returned by able', () => {
        assert.equal(view._getSupportLink(), UNSAFE_SUMO_LINK);
      });
    });
  });
});
