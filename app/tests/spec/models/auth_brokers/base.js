/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'chai',
  'models/reliers/relier',
  'models/auth_brokers/base',
  'views/base',
  '../../../mocks/window'
],
function (chai, Relier, BaseAuthenticationBroker,
  BaseView, WindowMock) {
  'use strict';

  var assert = chai.assert;

  describe('models/auth_brokers/base', function () {
    var relier;
    var broker;
    var view;
    var windowMock;

    beforeEach(function () {
      view = new BaseView();
      windowMock = new WindowMock();
      relier = new Relier();
      broker = new BaseAuthenticationBroker({
        relier: relier,
        window: windowMock
      });
    });

    function testDoesNotHalt(behavior) {
      assert.ok(behavior);
      assert.isFalse(behavior.halt);
    }

    describe('afterLoaded', function () {
      it('returns a promise', function () {
        return broker.afterLoaded()
          .then(assert.pass);
      });
    });

    describe('cancel', function () {
      it('returns a promise', function () {
        return broker.cancel()
          .then(assert.pass);
      });
    });

    describe('persist', function () {
      it('returns a promise', function () {
        return broker.persist(view)
          .then(assert.pass);
      });
    });


    describe('afterChangePassword', function () {
      it('returns a promise', function () {
        return broker.afterChangePassword(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterCompleteResetPassword', function () {
      it('returns a promise', function () {
        return broker.afterCompleteResetPassword(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterCompleteSignUp', function () {
      it('returns a promise', function () {
        return broker.afterCompleteSignUp(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterDeleteAccount', function () {
      it('returns a promise', function () {
        return broker.afterDeleteAccount(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterResetPasswordConfirmationPoll', function () {
      it('returns a promise', function () {
        return broker.afterResetPasswordConfirmationPoll(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterSignIn', function () {
      it('returns a promise', function () {
        return broker.afterSignIn(view)
          .then(testDoesNotHalt);
      });
    });

    describe('beforeSignIn', function () {
      it('returns a promise', function () {
        return broker.beforeSignIn(view)
          .then(testDoesNotHalt);
      });
    });

    describe('afterSignUpConfirmationPoll', function () {
      it('returns a promise', function () {
        return broker.afterSignUpConfirmationPoll(view)
          .then(testDoesNotHalt);
      });
    });

    describe('beforeSignUpConfirmationPoll', function () {
      it('returns a promise', function () {
        return broker.beforeSignUpConfirmationPoll(view)
          .then(testDoesNotHalt);
      });
    });

    describe('transformLink', function () {
      it('does nothing to the link', function () {
        assert.equal(broker.transformLink('signin'), 'signin');
      });
    });

    describe('isForceAuth', function () {
      it('returns `false` by default', function () {
        assert.isFalse(broker.isForceAuth());
      });

      it('returns `true` if flow began at `/force_auth`', function () {
        windowMock.location.pathname = '/force_auth';
        return broker.fetch()
          .then(function () {
            assert.isTrue(broker.isForceAuth());
          });
      });
    });

    describe('isAutomatedBrowser', function () {
      it('returns `false` by default', function () {
        assert.isFalse(broker.isAutomatedBrowser());
      });

      it('returns `true` if the URL contains `isAutomatedBrowser=true`', function () {
        windowMock.location.search = '?automatedBrowser=true';
        return broker.fetch()
          .then(function () {
            assert.isTrue(broker.isAutomatedBrowser());
          });
      });
    });

    describe('isSignupDisabled', function () {
      it('returns `false` by default', function () {
        assert.isFalse(broker.isSignupDisabled());
      });
    });

    describe('getBehavior', function () {
      it('gets a behavior, if defined', function () {
        var behavior = broker.getBehavior('beforeSignIn');
        assert.isDefined(behavior);
      });

      it('throws if behavior is not defined', function () {
        assert.throws(function () {
          broker.getBehavior('NOT_SET');
        }, 'behavior not found for: NOT_SET');
      });
    });

    describe('setBehavior', function () {
      it('sets a behavior', function () {
        broker.setBehavior('new behavior', { halt: true });
        assert.isTrue(broker.getBehavior('new behavior').halt);
      });
    });
  });
});


