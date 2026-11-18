/* Uses the existing authenticated teacher API client; no browser secrets or separate login. */
(()=>{'use strict';window.WillenaHomeworkNotificationAPI={
 async list(){return window.UniversalAssignmentTracker.notificationRequest('teacher_homework_completion_reviews?select=completion_key&limit=10000')},
 async acknowledge(entry){const user=await window.UniversalAssignmentTracker.notificationIdentity();return window.UniversalAssignmentTracker.notificationRequest('teacher_homework_completion_reviews',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal,resolution=ignore-duplicates'},body:JSON.stringify({completion_key:entry.key,assignment_id:entry.assignmentId,student_id:entry.studentId,app_name:entry.app,class_name:entry.className,reviewed_by:user})})}
};})();