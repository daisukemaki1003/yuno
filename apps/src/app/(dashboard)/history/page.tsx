"use client";

import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/atoms/Select";
import {Input} from "@/shared/components/atoms/Input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/components/atoms/Pagination";
import {Calendar, Search} from "lucide-react";
import {Button} from "@/shared/components/atoms/Button";
import Tag from "@/shared/components/atoms/Tag";
import {useMeetingsList} from "@/features/meetings/hooks/useMeetingsList";

export default function HistoryPage() {
  const {meetings, loading, error} = useMeetingsList();

  return (
    <main className="mx-auto px-8">
      <div className="mb-6 flex items-center space-x-4">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <Input
            placeholder="議事録を検索する"
            className="bg-white pl-10"
          // value={searchTerm}
          // onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="タグを検索" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tag1">開発</SelectItem>
            <SelectItem value="tag2">コーポレートサイトリニューアル</SelectItem>
            <SelectItem value="tag3">XXX株式会社</SelectItem>
          </SelectContent>
        </Select>
        <Select
        // value={selectedTemplate}
        // onValueChange={setSelectedTemplate}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="テンプレート" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="template1">テンプレート1</SelectItem>
            <SelectItem value="template2">テンプレート2</SelectItem>
            <SelectItem value="template3">テンプレート3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {loading &&
          Array.from({length: 4}).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-40 animate-pulse rounded-lg border bg-white"
            >
              <div className="h-full w-full rounded-lg bg-gray-100" />
            </div>
          ))}

        {!loading && meetings.length === 0 && !error && (
          <div className="col-span-1 rounded-lg border border-dashed bg-white p-6 text-center text-sm text-gray-500">
            表示できる議事録がまだありません。
          </div>
        )}

        {meetings.map((item) => (
          <Link key={item.id} href={`/minutes/${item.id}`}>
            <div className="rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex-1 truncate text-xl font-bold text-gray-900">
                  {item.title}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-[300px] flex-shrink-0 truncate rounded-[4px] border-none bg-[#E7EEFF] px-2 py-0.5 text-xs text-[#7482A5] hover:bg-blue-500 hover:text-white"
                >
                  {item.category}
                </Button>
              </div>
              <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {item.tags.map((tag) => (
                    <Tag key={`${item.id}-${tag}`}>{tag}</Tag>
                  ))}
                </div>
                <div className="flex flex-shrink-0 items-center text-xs text-gray-500">
                  <Calendar size={16} className="mr-2" />
                  <span>{item.date}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">10</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </main>
  );
}
