/*global $ jQuery _*/

$(onLoad);

function getAdminTask() {
    var hash = $(window.location).attr('hash');
    var prefix = '#task=';
    if (hash.slice(0, prefix.length) === prefix) {
        return hash.slice(prefix.length);
    } else {
        return undefined;
    }
}

var haveUsedForcedHit = false;
function getForcedHit() {
    if (haveUsedForcedHit) return undefined;
    haveUsedForcedHit = true;
    var hash = $(window.location).attr('hash');
    var prefix = '#id=';
    if (hash.slice(0, prefix.length) === prefix) {
        return hash.slice(prefix.length);
    } else {
        return undefined;
    }
}

function ping() {
    $.post('/worker/ping', {}, function(data) {
        setTimeout(ping, 5000);
    });
}

var currentTypeGroup = null;

function showWithData(data) {
    $('.content-main').show();
    $('.login-content').hide();
    var iframe = $('<iframe src="about:blank" frameborder="0" border="0" cellspacing="0"/>');
    $('#hit-content').empty().append(iframe);
    function resizeIframe(iframe) {
        iframe.height = $(iframe).contents().find("body").prop("scrollHeight") + "px";
    }
    _.defer(function () {
        iframe.contents()[0].write(data.content);
    });
    currentTypeGroup = new CTypeGroup();
    $('#hit-modules').empty();
    for (var i = 0; i < data.modules.length; i++){
        (function (i) {
            var dest = $('<div/>').appendTo($('#hit-modules'));
            getModule(data.modules[i], function (mod) { registerModule(i, mod, dest); });
        })(i);
    }
}

var hitLoadingTime = undefined;
var maxWaitingTime = 45 * 1000;

function requestNextTask(response) {
    // Response is from the server indicating whether validation succeeded.
    if (response.error) {
	switch (response.explanation) {
	    case 'no_cookies' :
	    alert('Your cookies were cleared and you are no longer authenticated. Please reload this page and login with your worker id again.');
	    break;
	    case 'not_logged_in' :
	    alert('You are not logged in. Please reload this page and login with your worker id again.');
	    break;
	    
	};
	return;
    }






    if (hitLoadingTime === undefined) {
	hitLoadingTime = Date.now();
    }
    if (getAdminTask() !== undefined) {
        $('#next-task-button').attr('disabled', true);
        $.get('/admin/tasks/' + getAdminTask(), function (data) {
            $('.loading-holder').hide();
            showWithData(data);
        });
        return;
    }
    var getData = {};
    var forcedId = getForcedHit();
    if (forcedId !== undefined) {
        getData['force'] = true;
        getData['hitid'] = forcedId;
        getData['workerid'] = $('#worker-login-form').find('input:first').val();
    }
    $.post('/HIT/view/', getData, function(data) {
	$('.loading-holder').hide();

	if (data.no_hits) {
	    $('.content-main').hide();
	    $('.login-content').hide();
	    $('.turk-verify-content').hide();
	    if (data.unfinished_hits && (Date.now() - hitLoadingTime) < 45000) {
		$('.loading-holder').show();
		setTimeout(requestNextTask, 5000);
	    } else {
		$('.turk-no-hits').show();
	    }
	    return;
	}

	if (data.needs_login) {
	    if (data.reforce) {
                haveUsedForcedHit = false;
            }
	    $('.login-content').show();
	    return;
	}
	
	$('.content-main').show();
	$('.login-content').hide();

	if (data.reload_for_first_task) {
	    requestNextTask();
	} else if (data.completed_hit) {
	    $('.content-main').hide();
	    $('.login-content').hide();
	    $('.turk-verify-content').show().find('.secret-code').html(data.verify_code);
	} else {
            $('#hit-progress').text("You are on task " + (+data.task_num + 1) + " of " + data.num_tasks  + ".");
            showWithData(data.task);
	}
    });
}

function onLoad() {
    ping();

    $('#return-hit').click(function(e) {
	e.preventDefault();
	if (window.confirm('Are you sure you want to return this HIT? You will lose all of your progress and this HIT will be assigned to another worker.')) {
	    window.location.href = '/HIT/return';
	}
    });

    $('#next-task-button').click(function(evt) {
	evt.preventDefault();
        if (currentTypeGroup.validate()) {
	    submitTask(requestNextTask);
        } else {
            var invalidQ = $(".question-invalid");
            if (invalidQ) {
                $("#hit-modules-scroll").prop("scrollTop", invalidQ.prop("offsetTop")-16*5);
            }
        }
    });

    $('#worker-login-submit').click(function(evt) {
	evt.preventDefault();
	$.post('/worker/login/', {'workerid' : $('#worker-login-form').find('input:first').val()}, requestNextTask);
    });

    $('body').on('click', function (e) {
        var target = $(e.target);
        if (!target.hasClass('popover') && !target.parent().hasClass('popover') && !target.hasClass('help')) {
            $('.help').each(function() {
		$(this).popover('hide');
            });
        }
    });

    requestNextTask();
}

function submitTask(callback) {
    $.post('/HIT/submit/', {data : JSON.stringify(serializeModules())}, callback);
}

function serializeModules() {
    return currentTypeGroup.serialize();
}

function registerModule(i, data, dest) {
    var module_container = $(document.createElement('div'));
    var module = module_container.CType(currentTypeGroup, data);
    module.renderDisplay();
    dest.append($(document.createElement('li')).html(module_container));
    if (i == 0) {
        currentTypeGroup.showType(module);
    }
}

function getModule(module, callback) {
    $.get('/types/view/'+module, callback);
}
