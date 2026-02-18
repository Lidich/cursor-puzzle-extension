// JXA (JavaScript for Automation) audio helper
// Run with: osascript -l JavaScript audio-helper.js <filepath> <volume>
// Send commands via stdin: play | pause | stop

ObjC.import('AppKit');
ObjC.import('Foundation');

var sound = null;

function run(argv) {
  var filePath = argv[0];
  var volume = parseFloat(argv[1] || '0.5');

  sound = $.NSSound.alloc.initWithContentsOfFileByReference(filePath, true);
  if (!sound || !sound.duration) {
    $.NSFileHandle.fileHandleWithStandardError.writeData(
      $('audio-helper: failed to load file\n').dataUsingEncoding($.NSUTF8StringEncoding)
    );
    $.exit(1);
  }
  sound.loops = true;
  sound.volume = volume;

  var stdin = $.NSFileHandle.fileHandleWithStandardInput;
  var nc = $.NSNotificationCenter.defaultCenter;
  var buf = '';

  nc.addObserverForNameObjectQueueUsingBlock(
    $.NSFileHandleReadCompletionNotification,
    stdin,
    $.NSOperationQueue.mainQueue,
    function (notif) {
      var data = notif.userInfo.objectForKey(
        $.NSFileHandleNotificationDataItem
      );
      if (data.length === 0) {
        if (sound) sound.stop;
        $.exit(0);
        return;
      }
      buf += ObjC.unwrap(
        $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)
      );
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var c = lines[i].trim();
        if (c === 'play') {
          sound.resume;
          if (!sound.isPlaying) sound.play;
        } else if (c === 'pause') {
          sound.pause;
        } else if (c === 'stop') {
          sound.stop;
          $.exit(0);
        }
      }
      stdin.readInBackgroundAndNotify;
    }
  );

  stdin.readInBackgroundAndNotify;
  $.NSRunLoop.currentRunLoop.run;
}
