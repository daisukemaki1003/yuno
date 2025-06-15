export default function Footer() {
  return (
    <footer className="border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="text-gray-500 text-sm">© 2024 Yuno. All rights reserved.</div>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-500 hover:text-gray-900 text-sm">
              利用規約
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-900 text-sm">
              プライバシーポリシー
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-900 text-sm">
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
