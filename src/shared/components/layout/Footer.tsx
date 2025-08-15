export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            © 2024 Yuno. All rights reserved.
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
              利用規約
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
              プライバシーポリシー
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
