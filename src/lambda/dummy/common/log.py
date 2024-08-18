import logging

class Logger:
    def __init__(self, log_level=logging.DEBUG):
        # ロガーを設定
        self.logger = logging.getLogger('AppLogger')
        self.logger.setLevel(log_level)

        # フォーマットを設定
        formatter = logging.Formatter('%(asctime)s  - %(levelname)s - %(message)s - [%(filename)s:%(lineno)d]')

        # コンソールハンドラを設定
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)

        # ハンドラをロガーに追加
        self.logger.addHandler(console_handler)

    def error(self, message):
        self.logger.error(message)

    def info(self, message):
        self.logger.info(message)

    def warning(self, message):
        self.logger.warning(message)

log = Logger()

