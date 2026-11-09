import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_notifier.dart';
import '../home/home_screen.dart';
import '../plans/plans_screen.dart';
import '../nutrition/nutrition_screen.dart';
import '../training/routines_screen.dart';
import '../training/training_screen.dart';
import '../update/update_banner.dart';

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  final scaffoldKey = GlobalKey<ScaffoldState>();
  int index = 0;
  String panel = '';

  void openSection(_Section section) {
    setState(() {
      if (section.panel.isNotEmpty) {
        panel = section.panel;
      } else {
        panel = '';
        index = section.tab!;
      }
    });
    scaffoldKey.currentState?.closeDrawer();
  }

  Future<void> logout() async {
    scaffoldKey.currentState?.closeDrawer();
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      const HomeScreen(),
      const PlansScreen(),
      const TrainingScreen(),
      const HomeScreen(guests: true),
    ];
    return Scaffold(
      key: scaffoldKey,
      drawer: _OptionsDrawer(
        panel: panel,
        index: index,
        onSelect: openSection,
        onLogout: logout,
      ),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        leading: IconButton(
          tooltip: 'Opciones',
          onPressed: () => scaffoldKey.currentState?.openDrawer(),
          icon: const Icon(Icons.more_vert),
        ),
        title: const Text('FUERZA ÉLITE'),
      ),
      body: Column(
        children: [
          const UpdateBanner(),
          Expanded(child: panel == 'routines'
              ? const TrainerRoutinesScreen()
              : panel == 'nutrition'
                  ? const NutritionScreen()
                  : pages[index]),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() {
          index = i;
          panel = '';
        }),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Inicio'),
          NavigationDestination(icon: Icon(Icons.credit_card_outlined), selectedIcon: Icon(Icons.credit_card), label: 'Planes'),
          NavigationDestination(icon: Icon(Icons.fitness_center_outlined), selectedIcon: Icon(Icons.fitness_center), label: 'Entreno'),
          NavigationDestination(icon: Icon(Icons.group_outlined), selectedIcon: Icon(Icons.group), label: 'Invitados'),
        ],
      ),
    );
  }
}

class _Section {
  const _Section(this.label, this.icon, {this.tab, this.panel = '', this.caption = ''});
  final String label;
  final IconData icon;
  final int? tab;
  final String panel;
  final String caption;
}

const _principal = [
  _Section('Inicio', Icons.home_outlined, tab: 0),
  _Section('Planes', Icons.credit_card_outlined, tab: 1),
  _Section('Entreno', Icons.fitness_center_outlined, tab: 2),
  _Section('Invitados', Icons.group_outlined, tab: 3),
];

const _trainer = [
  _Section('Rutinas recibidas', Icons.calendar_view_week_outlined, panel: 'routines', caption: 'Lo que te asignó el entrenador'),
  _Section('Mi alimentación', Icons.restaurant_outlined, panel: 'nutrition', caption: 'Guía del día y hábitos'),
];

class _OptionsDrawer extends StatelessWidget {
  const _OptionsDrawer({
    required this.panel,
    required this.index,
    required this.onSelect,
    required this.onLogout,
  });

  final String panel;
  final int index;
  final ValueChanged<_Section> onSelect;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF10182A),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('FUERZA ÉLITE', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 2.4)),
                  SizedBox(height: 6),
                  Text('Opciones', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            const _GroupLabel('Principal'),
            for (final item in _principal)
              _OptionTile(
                section: item,
                selected: panel.isEmpty && index == item.tab,
                onTap: () => onSelect(item),
              ),
            const _GroupLabel('Del entrenador'),
            for (final item in _trainer)
              _OptionTile(
                section: item,
                selected: panel.isNotEmpty && panel == item.panel,
                onTap: () => onSelect(item),
              ),
            const Spacer(),
            const Divider(height: 1, color: Colors.white12),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.white70),
              title: const Text('Salir'),
              onTap: onLogout,
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Text(text.toUpperCase(), style: const TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({required this.section, required this.selected, required this.onTap});
  final _Section section;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? const Color(0xFF38BDF8) : Colors.white;
    return ListTile(
      leading: Icon(section.icon, color: color),
      title: Text(section.label, style: TextStyle(color: color, fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
      subtitle: section.caption.isEmpty ? null : Text(section.caption, style: const TextStyle(color: Colors.white54, fontSize: 12)),
      selected: selected,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      onTap: onTap,
    );
  }
}
