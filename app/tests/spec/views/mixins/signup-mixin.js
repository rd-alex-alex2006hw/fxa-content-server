/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Account = require('models/account');
  const assert = require('chai').assert;
  const Broker = require('models/auth_brokers/base');
  const p = require('lib/promise');
  const Relier = require('models/reliers/relier');
  const SignUpMixin = require('views/mixins/signup-mixin');
  const sinon = require('sinon');

  describe('views/mixins/signup-mixin', function () {
    it('exports correct interface', function () {
      assert.isObject(SignUpMixin);
      assert.lengthOf(Object.keys(SignUpMixin), 5);
      assert.isFunction(SignUpMixin.signUp);
      assert.isFunction(SignUpMixin.onSignUpSuccess);
    });

    describe('signUp', function () {
      var account;
      var broker;
      var flow;
      var relier;
      var view;

      beforeEach(function () {
        account = new Account({
          email: 'testuser@testuser.com'
        });

        broker = new Broker();
        flow = {};
        relier = new Relier();

        view = {
          _formPrefill: {
            clear: sinon.spy()
          },
          broker: broker,
          flow: flow,
          getStringifiedResumeToken: sinon.spy(),
          invokeBrokerMethod: sinon.spy(function () {
            return p();
          }),
          logEvent: sinon.spy(),
          logEventOnce: sinon.spy(),
          logFlowEvent: sinon.spy(),
          logViewEvent: sinon.spy(),
          navigate: sinon.spy(),
          onSignUpSuccess: SignUpMixin.onSignUpSuccess,
          relier: relier,
          signUp: SignUpMixin.signUp,
          user: {
            signUpAccount: sinon.spy(function (account) {
              return p(account);
            })
          }
        };
      });

      describe('account needs permissions', function () {
        beforeEach(function () {
          sinon.stub(relier, 'accountNeedsPermissions', function () {
            return true;
          });

          return view.signUp(account, 'password');
        });

        it('redirects to the `signup_permissions` screen', function () {
          assert.isTrue(view.navigate.calledOnce);

          var args = view.navigate.args[0];
          assert.equal(args[0], 'signup_permissions');
          assert.deepEqual(args[1].account, account);
          assert.isFunction(args[1].onSubmitComplete);
        });

        it('does not log any events', function () {
          assert.isFalse(view.logViewEvent.called);
        });
      });

      describe('broker supports chooseWhatToSync', function () {
        beforeEach(function () {
          sinon.stub(broker, 'hasCapability', function (capabilityName) {
            return capabilityName === 'chooseWhatToSyncWebV1';
          });

          return view.signUp(account, 'password');
        });

        it('redirects to the `choose_what_to_sync` screen', function () {
          assert.isTrue(view.navigate.calledOnce);

          var args = view.navigate.args[0];
          assert.equal(args[0], 'choose_what_to_sync');
          assert.deepEqual(args[1].account, account);
          assert.isFunction(args[1].onSubmitComplete);
        });

        it('does not log any events', function () {
          assert.isFalse(view.logViewEvent.called);
        });
      });

      describe('verified account', function () {
        beforeEach(function () {
          account.set('verified', true);

          return view.signUp(account, 'password');
        });

        it('calls view.logViewEvent correctly', function () {
          assert.equal(view.logViewEvent.callCount, 3);

          assert.isTrue(view.logViewEvent.calledWith('success'));
          assert.isTrue(view.logViewEvent.calledWith('signup.success'));
          assert.isTrue(view.logViewEvent.calledWith('preverified.success'));
        });

        it('calls view.logFlowEvent correctly', () => {
          assert.equal(view.logFlowEvent.callCount, 1);
          assert.equal(view.logFlowEvent.args[0].length, 2);
          assert.equal(view.logFlowEvent.args[0][0], 'attempt');
          assert.equal(view.logFlowEvent.args[0][1], 'signup');
        });

        it('calls view._formPrefill.clear', function () {
          assert.equal(view._formPrefill.clear.callCount, 1);
        });

        it('calls view.invokeBrokerMethod correctly', function () {
          assert.equal(view.invokeBrokerMethod.callCount, 2);

          var args = view.invokeBrokerMethod.args[0];
          assert.lengthOf(args, 2);
          assert.equal(args[0], 'beforeSignIn');
          assert.equal(args[1], account);

          args = view.invokeBrokerMethod.args[1];
          assert.lengthOf(args, 2);
          assert.equal(args[0], 'afterSignIn');
          assert.deepEqual(args[1], account);
        });

        it('calls view.navigate correctly', function () {
          assert.equal(view.navigate.callCount, 1);
          var args = view.navigate.args[0];
          assert.lengthOf(args, 1);
          assert.equal(args[0], 'signup_complete');
        });
      });

      describe('unverified account', function () {
        beforeEach(function () {
          account.set('verified', false);

          return view.signUp(account, 'password');
        });

        it('calls view.logViewEvent correctly', function () {
          assert.equal(view.logViewEvent.callCount, 2);
          assert.isTrue(view.logViewEvent.calledWith('success'));
          assert.isTrue(view.logViewEvent.calledWith('signup.success'));
        });

        it('calls view._formPrefill.clear correctly', function () {
          assert.equal(view._formPrefill.clear.callCount, 1);
          assert.lengthOf(view._formPrefill.clear.args[0], 0);
        });

        it('calls view.invokeBrokerMethod correctly', function () {
          assert.equal(view.invokeBrokerMethod.callCount, 2);

          var args = view.invokeBrokerMethod.args[0];
          assert.lengthOf(args, 2);
          assert.equal(args[0], 'beforeSignIn');
          assert.equal(args[1], account);

          args = view.invokeBrokerMethod.args[1];
          assert.lengthOf(args, 2);
          assert.equal(args[0], 'afterSignUp');
          assert.deepEqual(args[1], account);
        });

        it('calls view.navigate correctly', function () {
          assert.equal(view.navigate.callCount, 1);
          var args = view.navigate.args[0];
          assert.lengthOf(args, 2);
          assert.equal(args[0], 'confirm');
          assert.isObject(args[1]);
          assert.lengthOf(Object.keys(args[1]), 2);
          assert.equal(args[1].account, account);
          assert.equal(args[1].flow, flow);
        });
      });

      describe('_formPrefill undefined', function () {
        beforeEach(function () {
          view._formPrefill = undefined;
        });

        it('does not throw', function () {
          assert.doesNotThrow(function () {
            return view.onSignUpSuccess(account);
          });
        });
      });
    });
  });
});

