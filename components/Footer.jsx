import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 py-8 mt-auto bg-white">
      <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Image src="https://tncache1-f1.v3mh.com/image/2026/01/14/67727e3ade57c7062ef81a16d4f711a0.png" alt="NextTV" width={24} height={24} />
          <p className="text-gray-500 text-sm font-medium">
            © 2026 NextTV. 开源项目。
          </p>
        </div>
        <div className="flex gap-6">
          <a
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
            href="#"
          >
            隐私政策
          </a>
          <a
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
            href="#"
          >
            服务条款
          </a>
          <a
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
            href="#"
          >
            Cookie 偏好
          </a>
          <a
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
            href="#"
          >
            帮助中心
          </a>
        </div>
      </div>
    </footer>
  );
};
