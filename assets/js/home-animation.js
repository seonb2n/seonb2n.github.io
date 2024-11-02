

  (function() {
  function initMessages() {
    const messages = document.querySelectorAll('.message-bubble');
    const recentPosts = document.querySelector('.recent-posts');

    if (!messages.length) {
      console.log('No messages found');
      return;
    }

    // 모든 메시지에 show 클래스 추가
    setTimeout(() => {
      messages.forEach((message, index) => {
        const typingIndicator = message.querySelector('.typing-indicator');
        const messageContent = message.querySelector('.message-content');

        if (!typingIndicator || !messageContent) {
          console.log('Missing elements for message:', index);
          return;
        }

        message.classList.add('show');

        // typing indicator 효과 처리
        setTimeout(() => {
          if (typingIndicator && messageContent) {
            typingIndicator.style.display = 'none';
            messageContent.classList.remove('hidden');
          }
        }, 1500 + (index * 2000)); // 각 메시지마다 시간차 부여
      });

      // recent posts 표시
      setTimeout(() => {
        if (recentPosts) {
          recentPosts.classList.remove('hidden');
          recentPosts.classList.add('show');
        }
      }, (messages.length * 2000) + 1000);
    }, 100);
  }

  // 페이지 로드 시 실행
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessages);
} else {
  initMessages();
}
})();

