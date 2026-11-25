/* Per-teacher unread homework acknowledgements. */
(()=>{'use strict';window.WillenaHomeworkNotificationAPI={
 identity:()=>window.UniversalAssignmentTracker.notificationIdentity(),
 async list(){return window.UniversalAssignmentTracker.notificationRequest('teacher_homework_personal_reviews?select=completion_key&limit=10000')},
 async acknowledge(entry){const user=await this.identity();return window.UniversalAssignmentTracker.notificationRequest('teacher_homework_personal_reviews',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal,resolution=ignore-duplicates'},body:JSON.stringify({teacher_id:user,completion_key:entry.key,assignment_id:entry.assignmentId,student_id:entry.studentId,app_name:entry.app,class_name:entry.className})})}
};})();