class Archifind < Formula
  desc "Scan codebases and visualize architecture as an interactive graph"
  homepage "https://github.com/Mensa-Philosophical-Circle/archifind"
  url "https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/v1.0.1.tar.gz"
  version "1.0.1"
  sha256 "fc66a3f149b7a4c09d2da13777bafd5cb60c5caa36abfac8a9243ef09db06fba"
  license "ISC"

  depends_on "node"

  def install
    libexec.install Dir["*"]

    cd libexec do
      system "npm", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "run", "build"
    end

    (bin / "archifind").write <<~EOS
      #!/bin/sh
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/src/cli.js" "$@"
    EOS
  end

  test do
    assert_match "archifind", shell_output("#{bin}/archifind --help")
  end
end
